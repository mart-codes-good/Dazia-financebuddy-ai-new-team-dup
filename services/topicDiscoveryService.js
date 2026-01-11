/**
 * Topic Discovery Service
 * Returns official syllabus topics for supported courses.
 * Static lists for clean, demo-ready UX.
 */

/* =======================
   IFIC – Investment Funds in Canada
   ======================= */
const IFIC_TOPICS = [
  "The role of the mutual fund sales representative",
  "Overview of the Canadian financial marketplace",
  "Economic principles",
  "Getting to know the client",
  "Behavioural finance",
  "Tax and retirement planning",
  "Types of investment products and how they are traded",
  "Constructing investment portfolios",
  "Understanding financial statements",
  "The modern mutual fund",
  "Conservative mutual fund products",
  "Riskier mutual fund products",
  "Alternative managed products",
  "Understanding mutual fund performance",
  "Selecting a mutual fund",
  "Mutual fund fees and services",
  "Mutual fund dealer regulation",
  "Applying ethical standards"
];

/* =======================
   CSC – Volume 1
   ======================= */
const CSC_VOL_1_TOPICS = [
  "The Canadian securities industry",
  "The capital market",
  "The Canadian regulatory environment",
  "Overview of economics",
  "Economic policy",
  "Fixed-income securities: features and types",
  "Fixed-income securities: pricing and trading",
  "Equity securities: common and preferred shares",
  "Equity securities: equity transactions",
  "Derivatives",
  "Corporations and their financial statements",
  "Financing and listing securities"
];

/* =======================
   CSC – Volume 2
   ======================= */
const CSC_VOL_2_TOPICS = [
  "Fundamental and technical analysis",
  "Company analysis",
  "Introduction to the portfolio approach",
  "The portfolio management process",
  "Mutual funds: structure and regulation",
  "Mutual funds: types and features",
  "Exchange-traded funds",
  "Other managed products",
  "Structured products",
  "Canadian taxation",
  "Fee-based accounts",
  "Working with the retail client",
  "Working with the institutional client"
];

/* =======================
   Dispatcher
   ======================= */
async function getTopics(course) {
  switch (course) {
    case "IFIC":
      return IFIC_TOPICS;

    case "CSC_VOL_1":
      return CSC_VOL_1_TOPICS;

    case "CSC_VOL_2":
      return CSC_VOL_2_TOPICS;

    default:
      throw new Error("INVALID_COURSE");
  }
}

module.exports = { getTopics };