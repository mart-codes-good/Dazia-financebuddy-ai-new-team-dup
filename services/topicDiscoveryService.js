/**
 * Topic Discovery Service
 * Returns official syllabus topics for supported courses.
 * MVP approach: static lists for clean, demo-ready UX.
 */

const IFIC_TOPICS = [
  "The Mutual Funds Industry",
  "The Economy",
  "Financial Statements",
  "Money Markets and Interest Rates",
  "Fixed-Income Securities",
  "Equity Securities",
  "Derivatives",
  "Mutual Fund Structures",
  "Taxation",
  "Portfolio Management",
  "Registered Plans (RRSP/TFSA)",
  "Regulation and Ethics"
];

const CSC_TOPICS = [
  "The Canadian Investment Marketplace",
  "The Economy",
  "Fixed-Income Securities",
  "Common and Preferred Shares",
  "Derivatives",
  "Corporations and Financial Statements",
  "Managed Products",
  "Working with the Retail Client"
];

async function getTopics(course) {
  if (!['IFIC', 'CSC', 'LLQP'].includes(course)) {
    throw new Error('INVALID_COURSE');
  }

  if (course === 'IFIC') return IFIC_TOPICS;
  if (course === 'CSC') return CSC_TOPICS;

  return [];
}

module.exports = { getTopics };
