// Minimal example validations using plain JS (can be replaced by Yup/Zod later).

export function validateSignup(form) {
  if (!form.email || !form.password || !form.confirm_password || !form.organization) {
    return "All fields are required.";
  }
  if (form.password !== form.confirm_password) {
    return "Passwords do not match.";
  }
  if (form.password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}









