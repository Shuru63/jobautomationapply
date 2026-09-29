import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, applications, resumes, aiGenerations, automationRuns } from "@/db/schema";
import { desc, ilike, or, count, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    
    // Check admin role
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    // Search condition
    let whereCondition = undefined;
    if (search) {
      whereCondition = or(
        ilike(users.fullName, `%${search}%`),
        ilike(users.email, `%${search}%`)
      );
    }

    // Fetch paginated users
    const allUsers = await db.query.users.findMany({
      where: whereCondition,
      with: { profile: true },
      orderBy: [desc(users.createdAt)],
      limit,
      offset,
    });

    // Total count for pagination
    const totalResult = await db.select({ count: count() }).from(users).where(whereCondition);
    const totalUsers = totalResult[0].count;

    // For activity metrics, we can do parallel counts
    const allApps = await db.query.applications.findMany({ columns: { candidateId: true } });
    const allResumes = await db.query.resumes.findMany({ columns: { candidateId: true } });
    const allAiGen = await db.query.aiGenerations.findMany({ columns: { candidateId: true } });

    const usersData = allUsers.map((u) => {
      let appCount = 0;
      let resumeCount = 0;
      let aiGenCount = 0;

      if (u.profile) {
        appCount = allApps.filter(a => a.candidateId === u.profile!.id).length;
        resumeCount = allResumes.filter(r => r.candidateId === u.profile!.id).length;
        aiGenCount = allAiGen.filter(ai => ai.candidateId === u.profile!.id).length;
      }

      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        activity: {
          applications: appCount,
          resumes: resumeCount,
          aiGenerations: aiGenCount,
        }
      };
    });

    // System Telemetry 
    const aiStats = await db.select({
      totalInput: sql<number>`sum(input_tokens)`,
      totalOutput: sql<number>`sum(output_tokens)`
    }).from(aiGenerations);

    const workerStats = await db.select({
      status: automationRuns.status,
      count: count()
    }).from(automationRuns).groupBy(automationRuns.status);

    return NextResponse.json({ 
      users: usersData,
      pagination: {
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit)
      },
      telemetry: {
        tokens: {
          input: Number(aiStats[0]?.totalInput || 0),
          output: Number(aiStats[0]?.totalOutput || 0)
        },
        workers: workerStats
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
