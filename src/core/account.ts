export function normalizedEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw Error("יש להזין כתובת אימייל תקינה.");
  return email;
}
export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 10) throw Error("יש לבחור סיסמה באורך 10 תווים לפחות.");
  if (password !== confirmation) throw Error("הסיסמאות אינן תואמות.");
  return password;
}
export function validateRecoveryCode(value: string) {
  const token = value.trim();
  if (!/^\d{6,10}$/.test(token))
    throw Error("יש להזין את הקוד המספרי שהתקבל באימייל.");
  return token;
}
