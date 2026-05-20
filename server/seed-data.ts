import { getDb, createTemplate, createEmailSend, upsertMetrics } from "./db";

const MOCK_USER_ID = 1; // This will be set when a user logs in

const MOCK_TEMPLATES = [
  {
    name: "Cold Outreach - Tech Founders",
    subjectLine: "Quick idea for [Company]",
    body: "Hi [Name],\n\nI came across [Company] and thought your product could benefit from [specific feature].\n\nWould you be open to a quick 15-min call?\n\nBest,\n[Your Name]",
    category: "Cold Outreach",
  },
  {
    name: "Follow-up After Meeting",
    subjectLine: "Great meeting today - next steps",
    body: "Hi [Name],\n\nThanks for taking the time to chat today. I really enjoyed learning about [topic].\n\nAs discussed, I'll send over [deliverable] by [date].\n\nLooking forward to working together!\n\nBest,\n[Your Name]",
    category: "Follow-up",
  },
  {
    name: "Product Demo Request",
    subjectLine: "[Company] - product demo?",
    body: "Hi [Name],\n\nI noticed [Company] is using [competitor]. We recently helped [similar company] reduce costs by 40%.\n\nWould you be interested in seeing how?\n\nBest,\n[Your Name]",
    category: "Demo Request",
  },
  {
    name: "Reconnection Email",
    subjectLine: "Reconnecting after 6 months",
    body: "Hi [Name],\n\nIt's been a while! I wanted to reach out and see how things are going at [Company].\n\nWe've made some exciting updates that might be relevant to your team.\n\nLet's catch up soon!\n\nBest,\n[Your Name]",
    category: "Reconnection",
  },
  {
    name: "Value Prop - Time Savings",
    subjectLine: "Save your team 10 hours/week",
    body: "Hi [Name],\n\nMost teams like yours spend 10+ hours/week on [task]. We help cut that in half.\n\nWant to see a quick demo?\n\nBest,\n[Your Name]",
    category: "Value Prop",
  },
];

// Mock email sends with realistic open/reply rates\nconst generateMockSends = (templateId: number, templateName: string, count: number) => {\n  const sends = [];\n  const now = new Date();\n  const openRate = Math.random() * 0.5 + 0.2; // 20-70% open rate\n  const replyRate = Math.random() * 0.3 + 0.05; // 5-35% reply rate\n  const meetingRate = Math.random() * 0.2; // 0-20% meeting rate\n\n  for (let i = 0; i < count; i++) {\n    const sentAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // Last 30 days\n    const hasOpen = Math.random() < openRate;\n    const hasReply = hasOpen && Math.random() < replyRate;\n    const hasMeeting = hasReply && Math.random() < meetingRate;\n\n    sends.push({\n      templateId,\n      sentAt,\n      openedAt: hasOpen ? new Date(sentAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null,\n      firstReplyAt: hasReply ? new Date(sentAt.getTime() + Math.random() * 48 * 60 * 60 * 1000) : null,\n      meetingScheduled: hasMeeting,\n    });\n  }\n\n  return sends;\n};\n\nexport async function seedDatabase() {\n  try {\n    const db = await getDb();\n    if (!db) {\n      console.log(\"Database not available for seeding\");\n      return;\n    }\n\n    console.log(\"🌱 Starting database seed...\");\n\n    // Create templates\n    const createdTemplates = [];\n    for (const template of MOCK_TEMPLATES) {\n      const result = await createTemplate({\n        userId: MOCK_USER_ID,\n        name: template.name,\n        subjectLine: template.subjectLine,\n        body: template.body,\n        category: template.category,\n        tags: [],\n      });\n      createdTemplates.push(result);\n      console.log(`✓ Created template: ${template.name}`);\n    }\n\n    // Create email sends and metrics for each template\n    for (let i = 0; i < createdTemplates.length; i++) {\n      const templateId = i + 1; // Assuming IDs are sequential\n      const template = MOCK_TEMPLATES[i];\n      const sendCount = Math.floor(Math.random() * 30) + 10; // 10-40 sends per template\n\n      const sends = generateMockSends(templateId, template.name, sendCount);\n\n      // Create email sends\n      for (const send of sends) {\n        await createEmailSend({\n          userId: MOCK_USER_ID,\n          templateId: send.templateId,\n          recipientEmail: `prospect${Math.random().toString(36).substring(7)}@example.com`,\n          recipientCompany: `Company ${Math.floor(Math.random() * 1000)}`,\n          recipientTitle: [\"CEO\", \"Founder\", \"CTO\", \"VP Sales\", \"Manager\"][Math.floor(Math.random() * 5)],\n          sentAt: send.sentAt,\n          openedAt: send.openedAt,\n          firstReplyAt: send.firstReplyAt,\n          meetingScheduled: send.meetingScheduled,\n        });\n      }\n\n      // Calculate and store metrics\n      const opens = sends.filter(s => s.openedAt).length;\n      const replies = sends.filter(s => s.firstReplyAt).length;\n      const meetings = sends.filter(s => s.meetingScheduled).length;\n\n      await upsertMetrics({\n        templateId,\n        totalSends: sends.length,\n        opens,\n        replies,\n        meetingsBooked: meetings,\n      });\n\n      console.log(`✓ Created ${sends.length} email sends for: ${template.name}`);\n      console.log(`  - Opens: ${opens} (${((opens / sends.length) * 100).toFixed(1)}%)`);\n      console.log(`  - Replies: ${replies} (${((replies / sends.length) * 100).toFixed(1)}%)`);\n      console.log(`  - Meetings: ${meetings}`);\n    }\n\n    console.log(\"\\n✅ Database seed completed successfully!\");\n  } catch (error) {\n    console.error(\"❌ Error seeding database:\", error);\n    throw error;\n  }\n}\n"
