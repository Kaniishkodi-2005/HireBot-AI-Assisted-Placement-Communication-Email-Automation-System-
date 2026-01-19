import http from "./httpClient";

export async function fetchStudentDashboard() {
  const res = await http.get("/students/dashboard");
  return res.data;
}

export async function fetchStudents() {
  const res = await http.get("/students");
  return res.data;
}

export async function uploadStudentCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await http.post("/students/upload-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
}
