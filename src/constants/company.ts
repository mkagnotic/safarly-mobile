/**
 * The legal entity behind Safarly.
 *
 * Single source of truth for the About / Contact screens and both legal
 * documents, so the ownership wording can never drift between them.
 * ⚠️ Keep in sync with web `src/constants/company.ts`.
 */

export const PLATFORM_NAME = "Safarly";
export const COMPANY_NAME = "Vedanth LLC";
export const COMPANY_JURISDICTION = "a Washington State Limited Liability Company";
export const SUPPORT_EMAIL = "admin@mysafarly.com";

/** Copyright line. The year is passed in so the caller owns the clock. */
export const copyrightLine = (year: number) =>
  `© ${year} ${PLATFORM_NAME}. All rights reserved. ${PLATFORM_NAME} is developed and operated by ${COMPANY_NAME}, ${COMPANY_JURISDICTION}.`;

/** Privacy Policy / About wording — includes "developed". */
export const OWNERSHIP_STATEMENT = `${PLATFORM_NAME} and its associated website and mobile applications are owned, developed, and operated by ${COMPANY_NAME}, ${COMPANY_JURISDICTION}.`;

/** Terms of Service wording — "owned and operated", per the agreement's voice. */
export const OWNERSHIP_STATEMENT_TERMS = `${PLATFORM_NAME} and its associated website and mobile applications are owned and operated by ${COMPANY_NAME}, ${COMPANY_JURISDICTION}.`;

export const COMPANY_BLURB = `${COMPANY_NAME} is a technology company registered in Washington State, United States. We build and operate ${PLATFORM_NAME} with a single commitment: a secure, transparent and trusted platform for travelers and for the people who rely on them to move parcels across the world.`;
