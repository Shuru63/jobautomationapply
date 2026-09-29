import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Prevent modifying yourself
    if (id === currentUser.id) {
      return NextResponse.json({ error: "Cannot modify your own account" }, { status: 400 });
    }

    const updateData: any = {};
    if (body.action === "suspend") updateData.isActive = false;
    if (body.action === "activate") updateData.isActive = true;
    if (body.action === "promote") updateData.role = "admin";
    if (body.action === "demote") updateData.role = "candidate";

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await db.update(users).set(updateData).where(eq(users.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
