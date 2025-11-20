/* ===========================
   Smart Attendance - script.js
   Single-page step flow (clean, final)
   =========================== */

/* -------------
   LOCAL STORAGE KEYS
   ------------- */
const KEY_PROFILE = "sa_teacher_profile";
const KEY_CLASSES = "sa_classes";
const KEY_STUDENTS = "sa_students";       // object: { "FE-A": [ {id,name,parent}, ... ] }
const KEY_ATTEND = "sa_attendance";       // object: { "FE-A": { "2025-11-19": [ {id,name,parent,status}, ... ] } }

/* --------------------------------
   APP STATE (load from localStorage)
   -------------------------------- */
let profile = JSON.parse(localStorage.getItem(KEY_PROFILE)) || null;
let classes = JSON.parse(localStorage.getItem(KEY_CLASSES)) || []; 
let students = JSON.parse(localStorage.getItem(KEY_STUDENTS)) || {}; 
let attendance = JSON.parse(localStorage.getItem(KEY_ATTEND)) || {};

//// DOM shortcuts
const steps = Array.from(document.querySelectorAll(".step"));
const screens = {
  profile: document.getElementById("profileScreen"),
  classes: document.getElementById("classesScreen"),
  students: document.getElementById("studentsScreen"),
  attendance: document.getElementById("attendanceScreen")
};

const toastEl = document.getElementById("toast");
const briefName = document.getElementById("briefName");
const profileBrief = document.getElementById("profileBrief");

/* -----------------------
   UTILITIES
   ----------------------- */
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(()=> toastEl.classList.remove("show"), 1800);
}

function uid(prefix="id"){
  // simple unique id (timestamp + random)
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
}

function saveAll(){
  localStorage.setItem(KEY_CLASSES, JSON.stringify(classes));
  localStorage.setItem(KEY_STUDENTS, JSON.stringify(students));
  localStorage.setItem(KEY_ATTEND, JSON.stringify(attendance));
  if (profile) localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
}

/* -----------------------
   STEP NAVIGATION
   ----------------------- */
function goToStep(stepName){
  // update step buttons
  steps.forEach(s => s.classList.toggle("active", s.dataset.step === stepName));
  // show/hide screens
  Object.keys(screens).forEach(k => {
    screens[k].classList.toggle("hidden", k !== stepName);
  });
  // perform actions on entering certain screens
  if (stepName === "classes") renderClassChips();
  if (stepName === "students") populateStudentsClassSelect();
  if (stepName === "attendance") populateAttendanceClassSelect();
}

steps.forEach(btn => {
  btn.addEventListener("click", ()=> goToStep(btn.dataset.step));
});

/* -----------------------
   INITIAL LOAD
   ----------------------- */
window.addEventListener("DOMContentLoaded", () => {
  // populate profile fields if exists
  if (profile){
    document.getElementById("tName").value = profile.name || "";
    document.getElementById("tEmail").value = profile.email || "";
    document.getElementById("tPhone").value = profile.phone || "";
    document.getElementById("tSubject").value = profile.subject || "";
    briefName.textContent = profile.name || "";
    profileBrief.style.display = "flex";
  } else {
    profileBrief.style.display = "none";
  }

  // render classes & dropdowns
  renderClassChips();
  populateStudentsClassSelect();
  populateAttendanceClassSelect();

  // auto-skip to classes if profile exists
  if (profile) goToStep("classes");
  else goToStep("profile");
});

/* -----------------------
   PROFILE - Save & Edit
   ----------------------- */
document.getElementById("saveProfileBtn").addEventListener("click", () => {
  const name = document.getElementById("tName").value.trim();
  const email = document.getElementById("tEmail").value.trim();
  const phone = document.getElementById("tPhone").value.trim();
  const subject = document.getElementById("tSubject").value.trim();

  if (!name || !email || !phone) {
    showToast("Please fill name, email and phone.");
    return;
  }
  // basic phone validation (digits and length)
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) {
    showToast("Enter valid phone number (with country code if needed).");
    return;
  }

  profile = { name, email, phone: digits, subject };
  localStorage.setItem(KEY_PROFILE, JSON.stringify(profile));
  briefName.textContent = name;
  profileBrief.style.display = "flex";
  showToast("Profile saved");
  // move to classes automatically
  setTimeout(()=> goToStep("classes"), 400);
});

document.getElementById("editProfileBtn").addEventListener("click", ()=>{
  goToStep("profile");
});

/* -----------------------
   CLASSES - Add / render
   ----------------------- */
document.getElementById("addClassBtn").addEventListener("click", ()=>{
  const v = document.getElementById("classInput").value.trim().toUpperCase();
  if (!v) { showToast("Enter class code"); return; }
  if (!/^[A-Z0-9\- ]+$/.test(v)) { showToast("Use alphanumeric and - only"); return; }
  if (!classes.includes(v)){
    classes.push(v);
    students[v] = students[v] || [];
    saveAll();
    renderClassChips();
    populateStudentsClassSelect();
    populateAttendanceClassSelect();
    showToast("Class added");
  } else {
    showToast("Class already exists");
  }
  document.getElementById("classInput").value = "";
});

function renderClassChips(){
  const ul = document.getElementById("classList");
  ul.innerHTML = "";
  classes.forEach(c => {
    const li = document.createElement("li");
    li.className = "chip";
    li.innerHTML = `<span>${c}</span> <button class="btn ghost small" data-class="${c}">Remove</button>`;
    ul.appendChild(li);
  });

  // attach remove handlers
  ul.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      const cls = btn.dataset.class;
      if (!confirm(`Remove class ${cls}? (students & attendance will be kept but class removed)`)) return;
      classes = classes.filter(x=> x !== cls);
      saveAll();
      renderClassChips();
      populateStudentsClassSelect();
      populateAttendanceClassSelect();
      showToast("Class removed");
    });
  });
}

/* navigation from classes to students */
document.getElementById("toStudentsBtn").addEventListener("click", ()=>{
  if (classes.length === 0) { showToast("Add at least one class"); return; }
  goToStep("students");
});

document.getElementById("backToProfileFromClass").addEventListener("click", ()=> goToStep("profile"));

/* -----------------------
   STUDENTS - Add / render
   ----------------------- */
function populateStudentsClassSelect(){
  const sel = document.getElementById("studentsClassSelect");
  sel.innerHTML = "";
  classes.forEach(c => {
    sel.innerHTML += `<option value="${c}">${c}</option>`;
  });
  // if there is at least one class, render current class students
  if (classes.length) renderStudentsForClass(classes[0]);
  else document.getElementById("studentList").innerHTML = "<li class='muted'>No classes yet</li>";
}

document.getElementById("studentsClassSelect").addEventListener("change", (e)=>{
  renderStudentsForClass(e.target.value);
});

function renderStudentsForClass(className){
  const ul = document.getElementById("studentList");
  ul.innerHTML = "";
  const arr = students[className] || [];
  if (!arr.length) {
    ul.innerHTML = "<li class='muted'>No students added</li>";
    return;
  }
  arr.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} (Parent: ${s.parent})`;
    ul.appendChild(li);
  });
}

document.getElementById("addStudentBtn").addEventListener("click", ()=>{
  const className = document.getElementById("studentsClassSelect").value;
  const name = document.getElementById("studentName").value.trim();
  const parent = document.getElementById("parentNumber").value.trim().replace(/\D/g,"");

  if (!className) { showToast("Select class"); return; }
  if (!name || !parent) { showToast("Fill student name & parent number"); return; }
  if (parent.length < 8) { showToast("Enter valid parent number"); return; }

  const obj = { id: uid("s"), name, parent };
  students[className] = students[className] || [];
  students[className].push(obj);
  saveAll();
  document.getElementById("studentName").value = "";
  document.getElementById("parentNumber").value = "";
  renderStudentsForClass(className);
  showToast("Student added");
});

document.getElementById("generate65Btn").addEventListener("click", ()=>{
  const className = document.getElementById("studentsClassSelect").value;
  if (!className) { showToast("Select class"); return; }
  if (!confirm(`Auto-generate 65 students for ${className}?`)) return;
  students[className] = students[className] || [];
  const startIndex = students[className].length + 1;
  for (let i=0;i<65;i++){
    const idx = startIndex + i;
    students[className].push({ id: uid("s"), name: `Student ${idx}`, parent: "91XXXXXXXXXX" });
  }
  saveAll();
  renderStudentsForClass(className);
  showToast("65 students generated (edit parent numbers as needed)");
});

/* navigation */
document.getElementById("backToClassesBtn").addEventListener("click", ()=> goToStep("classes"));
document.getElementById("toAttendanceBtn").addEventListener("click", ()=>{
  // ensure at least one class has students
  const ok = classes.some(c => (students[c] || []).length > 0);
  if (!ok) { showToast("Add students to at least one class"); return; }
  goToStep("attendance");
});

/* -----------------------
   ATTENDANCE - populate, mark, submit
   ----------------------- */
function populateAttendanceClassSelect(){
  const sel = document.getElementById("attClassSelect");
  sel.innerHTML = "";
  classes.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  if (classes.length) loadAttendanceStudents(classes[0]);
  else {
    const tbody = document.querySelector("#attendanceTable tbody");
    tbody.innerHTML = `<tr><td colspan="4" class="muted">No classes available</td></tr>`;
  }
}

document.getElementById("attClassSelect").addEventListener("change", (e)=>{
  loadAttendanceStudents(e.target.value);
});

document.getElementById("attDate").addEventListener("change", ()=>{
  // optional: could load existing attendance for date
});

/* load students into attendance table for a class */
function loadAttendanceStudents(className){
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";
  const list = students[className] || [];
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">No students in this class</td></tr>`;
    return;
  }
  list.forEach((s, idx) => {
    // group radios per student by using id in name
    const nameGroup = `att_${className}_${s.id}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${s.name}</td>
      <td><input type="radio" name="${nameGroup}" value="Present" checked></td>
      <td><input type="radio" name="${nameGroup}" value="Absent"></td>
    `;
    tbody.appendChild(tr);
  });
}

/* mark all present/absent */
document.getElementById("markAllPresent").addEventListener("click", ()=>{
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.querySelectorAll("input[type=radio]").forEach(r=>{
    if (r.value === "Present") r.checked = true;
  });
});

document.getElementById("markAllAbsent").addEventListener("click", ()=>{
  const tbody = document.querySelector("#attendanceTable tbody");
  const rows = tbody.querySelectorAll("tr");
  rows.forEach(row=>{
    const radios = row.querySelectorAll("input[type=radio]");
    radios.forEach(r=>{
      if (r.value === "Absent") r.checked = true;
    });
  });
});

/* Submit attendance (build modal with absent list, teacher taps Send for each) */
document.getElementById("submitAttendanceBtn").addEventListener("click", ()=>{
  const className = document.getElementById("attClassSelect").value;
  const date = document.getElementById("attDate").value || new Date().toISOString().split("T")[0];

  if (!className) {
    showToast("Select a class");
    return;
  }

  const list = students[className] || [];
  if (!list.length) {
    showToast("No students to mark");
    return;
  }

  const tbody = document.querySelector("#attendanceTable tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const records = [];

  rows.forEach((row, idx) => {
    const s = list[idx];
    const groupName = `att_${className}_${s.id}`;
    const sel = document.querySelector(`input[name="${groupName}"]:checked`);
    const status = sel ? sel.value : "Present";

    records.push({
      id: s.id,
      name: s.name,
      parent: s.parent,
      status
    });
  });

  // save attendance
  attendance[className] = attendance[className] || {};
  attendance[className][date] = records;
  saveAll();
  showToast("Attendance saved");

  // Build modal list for absentees
  const absents = records.filter(r => r.status === "Absent");

  const modal = document.getElementById("absentModal");
  const listEl = document.getElementById("absentList");
  listEl.innerHTML = "";

  absents.forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${a.name}</strong><br>
      Parent: ${a.parent}<br>
      <button class="absent-btn btn small" data-phone="${a.parent}" data-name="${a.name}">
        Send WhatsApp
      </button>
    `;
    listEl.appendChild(li);
  });

  // If no absentees, inform teacher
  if (absents.length === 0) {
    listEl.innerHTML = `<li class="muted">All students are present 🎉</li>`;
  }

  modal.classList.remove("hidden");

  // WhatsApp button handler (each click is a user gesture, so not blocked)
  listEl.querySelectorAll(".absent-btn").forEach(btn => {
    btn.addEventListener("click", ()=>{
      const phone = btn.dataset.phone;
      const name = btn.dataset.name;
      const sender = profile && profile.name ? profile.name : "";
      const msg = `Dear Parent, your child ${name} was absent on ${date}. - ${sender}`;

      const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    });
  });

});

/* close modal */
document.getElementById("closeAbsentModal").addEventListener("click", ()=>{
  document.getElementById("absentModal").classList.add("hidden");
});

document.getElementById("downloadReportBtn").addEventListener("click", () => {
  const cls = document.getElementById("attClassSelect").value;

  if (!cls) {
    showToast("Select a class first");
    return;
  }

  const classAttendance = attendance[cls];
  if (!classAttendance || Object.keys(classAttendance).length === 0) {
    showToast("No attendance recorded for this class");
    return;
  }

  let csv = "Class,Date,Student,Status,Parent\n";

  for (const dt of Object.keys(classAttendance)) {
    classAttendance[dt].forEach(rec => {
      const safeName = (rec.name || "").replace(/"/g, '""');
      csv += `${cls},${dt},"${safeName}",${rec.status},${rec.parent}\n`;
    });
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${cls}_attendance_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
});

/* quick access: edit profile from attendance */
document.getElementById("editProfileFromAttendance").addEventListener("click", ()=> goToStep("profile"));

/* back button */
document.getElementById("backToStudentsBtn").addEventListener("click", ()=> goToStep("students"));

/* extra: when profile brief shown, clicking name edits profile */
briefName.addEventListener("click", ()=> goToStep("profile"));

/* ensure dropdowns are updated when classes & students change */
function populateStudentsClassSelect(){
  const sel = document.getElementById("studentsClassSelect");
  sel.innerHTML = "";
  classes.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  if (classes.length) renderStudentsForClass(classes[0]);
}
function renderStudentsForClass(className){
  const ul = document.getElementById("studentList");
  ul.innerHTML = "";
  const arr = students[className] || [];
  if (!arr.length) { ul.innerHTML = "<li class='muted'>No students added</li>"; return; }
  arr.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} (Parent: ${s.parent})`;
    ul.appendChild(li);
  });
}
function populateAttendanceClassSelect(){
  const sel = document.getElementById("attClassSelect");
  sel.innerHTML = "";
  classes.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  if (classes.length) loadAttendanceStudents(classes[0]);
}
function loadAttendanceStudents(className){
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";
  const list = students[className] || [];
  if (!list.length) { tbody.innerHTML = `<tr><td colspan="4" class="muted">No students in this class</td></tr>`; return; }
  list.forEach((s, idx) => {
    const nameGroup = `att_${className}_${s.id}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${s.name}</td>
      <td><input type="radio" name="${nameGroup}" value="Present" checked></td>
      <td><input type="radio" name="${nameGroup}" value="Absent"></td>
    `;
    tbody.appendChild(tr);
  });
}

/* ensure UI updates when students/classes change from other functions */
function refreshAllUI(){
  renderClassChips();
  populateStudentsClassSelect();
  populateAttendanceClassSelect();
  if (profile) {
    briefName.textContent = profile.name;
    profileBrief.style.display = "flex";
  }
}



