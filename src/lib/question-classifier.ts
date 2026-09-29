export type QuestionCategory =
  | "factual"        // Answer from profile data
  | "yes_no"         // Yes/No questions
  | "numeric"        // Numbers (years, salary, etc.)
  | "text"           // Short text
  | "textarea"       // Long text / essay
  | "salary"         // Salary/compensation
  | "location"       // Location/relocation
  | "authorization"  // Work authorization/visa
  | "sensitive"      // Legal declarations, NDAs
  | "file_upload"    // Resume, cover letter, portfolio
  | "select"         // Dropdown selection
  | "date";          // Date fields

export type ClassifiedQuestion = {
  originalText: string;
  category: QuestionCategory;
  fieldHint: string; // Which profile field maps to this
  requiresApproval: boolean;
  confidence: number;
};

const CATEGORY_PATTERNS: Array<{
  patterns: RegExp[];
  category: QuestionCategory;
  fieldHint: string;
  requiresApproval: boolean;
}> = [
  {
    patterns: [/first\s*name/i, /given\s*name/i, /fname/i],
    category: "factual",
    fieldHint: "firstName",
    requiresApproval: false,
  },
  {
    patterns: [/last\s*name/i, /surname/i, /family\s*name/i, /lname/i],
    category: "factual",
    fieldHint: "lastName",
    requiresApproval: false,
  },
  {
    patterns: [/full\s*name/i, /your\s*name/i, /candidate\s*name/i],
    category: "factual",
    fieldHint: "fullName",
    requiresApproval: false,
  },
  {
    patterns: [/e-?mail/i, /email\s*address/i],
    category: "factual",
    fieldHint: "email",
    requiresApproval: false,
  },
  {
    patterns: [/phone/i, /mobile/i, /contact\s*number/i, /tel/i],
    category: "factual",
    fieldHint: "phone",
    requiresApproval: false,
  },
  {
    patterns: [/linkedin/i],
    category: "factual",
    fieldHint: "linkedin",
    requiresApproval: false,
  },
  {
    patterns: [/github/i],
    category: "factual",
    fieldHint: "github",
    requiresApproval: false,
  },
  {
    patterns: [/portfolio/i, /personal\s*website/i, /url/i],
    category: "factual",
    fieldHint: "portfolio",
    requiresApproval: false,
  },
  {
    patterns: [/years?\s*of\s*experience/i, /how\s*many\s*years/i, /experience\s*level/i, /yoe/i],
    category: "numeric",
    fieldHint: "experienceYears",
    requiresApproval: false,
  },
  {
    patterns: [/current\s*(company|employer)/i, /where\s*do\s*you\s*work/i],
    category: "factual",
    fieldHint: "currentCompany",
    requiresApproval: false,
  },
  {
    patterns: [/current\s*(title|role|position)/i, /job\s*title/i],
    category: "factual",
    fieldHint: "currentTitle",
    requiresApproval: false,
  },
  {
    patterns: [/salary/i, /compensation/i, /ctc/i, /expected\s*pay/i, /pay\s*range/i],
    category: "salary",
    fieldHint: "expectedSalary",
    requiresApproval: true,
  },
  {
    patterns: [/authorized?\s*to\s*work/i, /work\s*authorization/i, /right\s*to\s*work/i, /visa/i, /sponsorship/i, /require\s*sponsor/i],
    category: "authorization",
    fieldHint: "workAuthorization",
    requiresApproval: true,
  },
  {
    patterns: [/relocat/i, /willing\s*to\s*move/i, /open\s*to\s*relocation/i],
    category: "location",
    fieldHint: "openToRelocation",
    requiresApproval: false,
  },
  {
    patterns: [/remote/i, /work\s*from\s*home/i, /hybrid/i, /on-?site/i],
    category: "location",
    fieldHint: "remotePreference",
    requiresApproval: false,
  },
  {
    patterns: [/notice\s*period/i, /start\s*date/i, /available\s*from/i, /when\s*can\s*you\s*start/i],
    category: "factual",
    fieldHint: "noticePeriod",
    requiresApproval: false,
  },
  {
    patterns: [/why\s*(do\s*you|would\s*you|should\s*we)/i, /motivation/i, /why\s*this\s*(company|role|position)/i, /tell\s*us\s*about/i, /describe\s*your/i, /explain\s*how/i],
    category: "textarea",
    fieldHint: "aiGenerated",
    requiresApproval: true,
  },
  {
    patterns: [/cover\s*letter/i, /additional\s*information/i, /anything\s*else/i],
    category: "textarea",
    fieldHint: "coverLetter",
    requiresApproval: true,
  },
  {
    patterns: [/upload/i, /attach/i, /resume|cv|curriculum/i, /portfolio\s*file/i],
    category: "file_upload",
    fieldHint: "resume",
    requiresApproval: false,
  },
  {
    patterns: [/agree\s*to\s*terms/i, /acknowledge/i, /confirm\s*that/i, /legal/i, /privacy\s*policy/i, /data\s*processing/i],
    category: "sensitive",
    fieldHint: "legalAgreement",
    requiresApproval: true,
  },
  {
    patterns: [/gender/i, /race/i, /ethnicity/i, /disability/i, /veteran/i, /pronouns/i],
    category: "sensitive",
    fieldHint: "demographic",
    requiresApproval: true,
  },
  {
    patterns: [/education/i, /degree/i, /university/i, /college/i, /qualification/i],
    category: "factual",
    fieldHint: "education",
    requiresApproval: false,
  },
  {
    patterns: [/date\s*of\s*birth/i, /dob/i, /age/i],
    category: "sensitive",
    fieldHint: "dateOfBirth",
    requiresApproval: true,
  },
];

export function classifyQuestion(questionText: string): ClassifiedQuestion {
  const text = questionText.toLowerCase().trim();

  for (const rule of CATEGORY_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          originalText: questionText,
          category: rule.category,
          fieldHint: rule.fieldHint,
          requiresApproval: rule.requiresApproval,
          confidence: 0.9,
        };
      }
    }
  }

  // Default classification
  if (text.length < 100) {
    return {
      originalText: questionText,
      category: "text",
      fieldHint: "unknown",
      requiresApproval: true,
      confidence: 0.3,
    };
  }

  return {
    originalText: questionText,
    category: "textarea",
    fieldHint: "aiGenerated",
    requiresApproval: true,
    confidence: 0.3,
  };
}

export function classifyQuestions(questions: string[]): ClassifiedQuestion[] {
  return questions.map(classifyQuestion);
}