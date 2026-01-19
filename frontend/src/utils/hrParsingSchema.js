// Strict JSON schema for HR email parsing
export const HR_EMAIL_SCHEMA = {
  role: null,
  skills: [],
  count: null,
  eligibility: null,
  salary: null,
  location: null,
  mode: null,
  type: null,
  duration: null,
  deadline: null,
  action_required: null,
  reminder_requested: false,
  additional_notes: ""
};

// System prompt for AI parsing
export const PARSING_INSTRUCTIONS = 'Extract campus placement or internship requirements from the HR email below and return them in the specified JSON format.';

export default { HR_EMAIL_SCHEMA, PARSING_INSTRUCTIONS };