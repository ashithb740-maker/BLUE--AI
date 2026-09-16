export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// BLUE now opens the Gemini-powered chat directly. Authentication and
// persistence can be layered on top of the Supabase-backed chat in the next step.
export const startLogin = () => {
  window.location.href = "/chat";
};
