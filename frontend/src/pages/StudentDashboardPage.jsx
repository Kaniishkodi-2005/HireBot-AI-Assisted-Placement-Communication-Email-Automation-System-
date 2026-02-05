import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchStudentDashboard, uploadStudentCsv, fetchStudents } from "../services/studentService";
import Pagination from "../components/Pagination";
import { GraduationCap, Building2, Layout } from "lucide-react";

function StudentDashboardPage() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState('all');
  const [countFilter, setCountFilter] = useState(10);
  const [allStudentsDeptFilter, setAllStudentsDeptFilter] = useState('all');

  const [searchQuery, setSearchQuery] = useState('');

  // Data State
  const [students, setStudents] = useState([]);

  // Upload State
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const data = await fetchStudentDashboard();
      setMetrics(data);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const list = await fetchStudents();
      setStudents(list);
    } catch (err) {
      console.error("Failed to load students", err);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadStudents();
  }, []);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setUploadSuccess(false);
    setUploadMessage("");

    try {
      const result = await uploadStudentCsv(file);
      setUploadSuccess(true);
      setUploadMessage(`Successfully uploaded ${result.length} student(s)!`);
      // Reload everything to show new data
      await loadMetrics();
      await loadStudents();

      setTimeout(() => {
        setUploadSuccess(false);
        setUploadMessage("");
      }, 5000);
    } catch (error) {
      setUploadSuccess(false);
      setUploadMessage("Upload failed. Please check the file format.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // Filter top students based on department selection
  const getFilteredTopStudents = () => {
    const studentsData = students || [];
    if (studentsData.length === 0) return [];

    const getSkillScore = (skillText, skill) => {
      const match = skillText?.match(new RegExp(`${skill}-(\\d+)`, 'i'));
      return match ? parseInt(match[1]) : 0;
    };

    const parsePs = (psString) => {
      const skills = {}
      if (!psString) return skills

      psString.split(/[,;]/).forEach(item => {
        const [name, value] = item.split(/[-:]/)
        if (name && value) {
          skills[name.trim().toLowerCase()] = parseFloat(value)
        }
      })

      return skills
    }

    const calculateBalancedScore = (psString) => {
      const ps = parsePs(psString)

      const coreSkills = [
        ps.python || 0,
        ps.java || 0,
        ps.c || 0,
        ps.sql || 0
      ]

      const avgProgramming =
        coreSkills.reduce((a, b) => a + b, 0) / coreSkills.length

      const aptitude = ps.aptitude || 0
      const strongestSkill = Math.max(...coreSkills)

      const score =
        avgProgramming * 0.5 +
        aptitude * 0.3 +
        strongestSkill * 0.2

      return Number(score.toFixed(2))
    }

    const calculateCoreBalancedScore = (psString) => {
      const ps = parsePs(psString)

      const coreSkills = [
        ps.analog || 0,
        ps.digital || 0
      ]

      const avgCore =
        coreSkills.reduce((a, b) => a + b, 0) / coreSkills.length

      const aptitude = ps.aptitude || 0
      const strongestCoreSkill = Math.max(...coreSkills)

      const score =
        avgCore * 0.5 +
        aptitude * 0.3 +
        strongestCoreSkill * 0.2

      return Number(score.toFixed(2))
    }

    const getTotalScore = (student, category) => {
      if (category === 'software' || category === 'all') {
        return calculateBalancedScore(student.skills_text);
      }

      if (category === 'core') {
        return calculateCoreBalancedScore(student.skills_text);
      }

      return 0;
    };

    let filtered = [];

    if (deptFilter === 'all') {
      filtered = [...studentsData].sort((a, b) => getTotalScore(b, 'all') - getTotalScore(a, 'all'));
    } else if (deptFilter === 'software') {
      filtered = studentsData
        .filter(s => s.department && ['CSE', 'IT', 'AIML', 'AIDS', 'CSBS'].includes(s.department.toUpperCase()))
        .sort((a, b) => getTotalScore(b, 'software') - getTotalScore(a, 'software'));
    } else if (deptFilter === 'core') {
      filtered = studentsData
        .filter(s => s.department && !['CSE', 'IT', 'AIML', 'AIDS', 'CSBS'].includes(s.department.toUpperCase()))
        .sort((a, b) => getTotalScore(b, 'core') - getTotalScore(a, 'core'));
    }

    return filtered.slice(0, countFilter);
  };

  // Pagination Logic
  const getFilteredAllStudents = () => {
    let filtered = students;

    // Apply department filter
    if (allStudentsDeptFilter === 'software') {
      filtered = filtered.filter(s => s.department && ['CSE', 'IT', 'AIML', 'AIDS', 'CSBS'].includes(s.department.toUpperCase()));
    } else if (allStudentsDeptFilter === 'core') {
      filtered = filtered.filter(s => s.department && !['CSE', 'IT', 'AIML', 'AIDS', 'CSBS'].includes(s.department.toUpperCase()));
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(s =>
        s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.roll_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.domain?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredStudents = getFilteredAllStudents();
  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white transition-colors">Student Dashboard</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm transition-colors">Overview of student placements and skills</p>
        </div>

        <div className="flex items-center gap-3">
          {uploadSuccess && (
            <div className="text-sm text-green-700 bg-green-100 border border-green-200 px-3 py-2 rounded shadow-sm animate-fade-in">
              ✅ {uploadMessage}
            </div>
          )}
          {!uploadSuccess && uploadMessage && (
            <div className="text-sm text-red-700 bg-red-100 border border-red-200 px-3 py-2 rounded shadow-sm animate-fade-in">
              ❌ {uploadMessage}
            </div>
          )}

          {/* Action Buttons */}
          <label className="cursor-pointer text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 transform active:scale-95" style={{ backgroundColor: '#AF69F8' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Bulk Upload
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => navigate("/dashboard/students/edit")}
            className="bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all flex items-center gap-2 transform active:scale-95"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Manage
          </button>
        </div>
      </header>

      {loading && !metrics ? (
        <div className="flex justify-center py-12">
          <p className="text-slate-500 animate-pulse">Loading dashboard data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Row: Metrics Cards */}
          <section className="grid md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-purple-50/20 dark:hover:bg-purple-900/10 border border-transparent hover:border-purple-200 dark:hover:border-purple-900 cursor-pointer shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mt-2">Total Students</p>
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                  <GraduationCap className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">{metrics?.total_students || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-amber-50/20 dark:hover:bg-amber-900/10 border border-transparent hover:border-amber-200 dark:hover:border-amber-900 cursor-pointer shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mt-2">Department Count</p>
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                  <Building2 className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">{metrics?.department_count || 0}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-pink-50/20 dark:hover:bg-pink-900/10 border border-transparent hover:border-pink-200 dark:hover:border-pink-900 cursor-pointer shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors mt-2">Domain Count</p>
                <div className="p-2 bg-pink-50 dark:bg-pink-900/20 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
                  <Layout className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                </div>
              </div>
              <p className="text-4xl font-bold text-slate-800 dark:text-white group-hover:text-pink-700 dark:group-hover:text-pink-400 transition-colors">{metrics?.domain_count || 0}</p>
            </div>
          </section>

          {/* Show empty state if no students */}
          {(!metrics || metrics.total_students === 0) ? (
            <>
              {/* Middle Row: Split View */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Top PS Students (Wider: col-span-2) */}
                <section className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full transition-colors">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                      <span className="text-amber-500">🏆</span> TOP PS STUDENTS
                    </h3>
                  </div>
                  <div className="flex flex-col items-center justify-center h-full py-12 text-slate-400 dark:text-gray-500">
                    <span className="text-4xl mb-2">📊</span>
                    <p className="text-sm">No students found.</p>
                    <p className="text-xs mt-1">Upload a CSV or Excel file to get started.</p>
                  </div>
                </section>

                {/* Right: Detailed Counts (Narrower: col-span-1) */}
                <section className="space-y-6">
                  {/* Department Breakdown */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm">Department Breakdown</h3>
                    </div>
                    <div className="p-8 text-center text-slate-400 dark:text-gray-500">
                      <p className="text-xs">No department data found.</p>
                    </div>
                  </div>

                  {/* Domain Breakdown */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm">Domain Breakdown</h3>
                    </div>
                    <div className="p-8 text-center text-slate-400 dark:text-gray-500">
                      <p className="text-xs">No domain data found.</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Bottom Row: Full Student List */}
              <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg">All Students</h3>
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">Showing 0 record(s)</p>
                </div>
                <div className="p-12 text-center text-slate-400 dark:text-gray-500">
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-gray-300 mb-2">No students found.</h3>
                  <p className="text-sm">Upload a CSV or Excel file to get started.</p>
                </div>
              </section>
            </>
          ) : (
            <>
              {/* Middle Row: Split View */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Top PS Students (Wider: col-span-2) */}
                <section className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full transition-colors">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                      <span className="text-amber-500">🏆</span> TOP PS STUDENTS
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                        <button
                          onClick={() => setDeptFilter('all')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${deptFilter === 'all'
                            ? 'text-white shadow-sm'
                            : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          style={deptFilter === 'all' ? { backgroundColor: '#AF69F8' } : {}}
                        >
                          All
                        </button>
                        <button
                          onClick={() => setDeptFilter('software')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${deptFilter === 'software'
                            ? 'text-white shadow-sm'
                            : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          style={deptFilter === 'software' ? { backgroundColor: '#AF69F8' } : {}}
                        >
                          Software
                        </button>
                        <button
                          onClick={() => setDeptFilter('core')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${deptFilter === 'core'
                            ? 'text-white shadow-sm'
                            : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          style={deptFilter === 'core' ? { backgroundColor: '#AF69F8' } : {}}
                        >
                          Core
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1">
                        <span className="text-xs text-slate-600 dark:text-gray-300 font-medium">Top</span>
                        <input
                          type="number"
                          value={countFilter}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              setCountFilter('');
                            } else {
                              setCountFilter(Number(value) || 1);
                            }
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || Number(e.target.value) < 1) {
                              setCountFilter(1);
                            }
                          }}
                          min="1"
                          max="100"
                          className="w-12 text-xs text-center bg-white dark:bg-slate-600 dark:text-white border-0 rounded px-1 py-0.5 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>

                      <span className="text-xs text-slate-500 dark:text-gray-400 font-medium bg-white dark:bg-slate-700 px-2 py-1 rounded border border-slate-200 dark:border-slate-600">
                        Live Ranking
                      </span>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4 space-y-3 max-h-[400px]">
                    {getFilteredTopStudents().length > 0 ? (
                      getFilteredTopStudents().map((s, i) => (
                        <div key={s.id} className="flex items-center bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group">
                          {/* Rank Badge */}
                          <div className={`
                        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mr-4 shadow-sm
                        ${i === 0 ? 'bg-yellow-400 text-white' : ''}
                        ${i === 1 ? 'bg-slate-300 text-slate-700' : ''}
                        ${i === 2 ? 'bg-orange-400 text-white' : ''}
                        ${i > 2 ? 'bg-slate-50 dark:bg-slate-600 text-slate-500 dark:text-gray-300 border border-slate-200 dark:border-slate-500' : ''}
                      `}>
                            #{i + 1}
                          </div>

                          {/* Avatar */}
                          <div className="flex-shrink-0 mr-4 relative">
                            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center overflow-hidden">
                              <span className="text-xl">👨‍🎓</span>
                            </div>
                          </div>

                          {/* Student Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-600 dark:text-gray-300 text-xs truncate" title={s.name}>{s.name}</h4>
                            <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium mt-0.5 truncate">{s.roll_no || s.department}</p>
                          </div>

                          {/* Score Badge (Right Aligned) */}
                          <div className="text-right pl-2 max-w-[40%] flex justify-end">
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 truncate block text-ellipsis max-w-full" title={s.skills_text}>
                              {s.skills_text ? s.skills_text.toUpperCase() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 italic">
                        <span className="text-2xl mb-2">📊</span>
                        No rankings available yet.
                      </div>
                    )}
                  </div>
                </section>

                {/* Right: Detailed Counts (Narrower: col-span-1) */}
                <section className="space-y-6">
                  {/* Department Breakdown */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm">Department Breakdown</h3>
                    </div>
                    {/* Changed to Single Column (grid-cols-1) */}
                    <div className="p-4 grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {metrics.dept_counts && Object.entries(metrics.dept_counts).length > 0 ? (
                        Object.entries(metrics.dept_counts).map(([dept, count]) => (
                          <div key={dept} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-100 dark:border-slate-600 px-3 py-2 rounded transition-colors">
                            <span className="text-xs text-slate-600 dark:text-gray-300 font-bold">{dept}</span>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">{count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-gray-500 text-center py-2">No department data found.</p>
                      )}
                    </div>
                  </div>

                  {/* Domain Breakdown */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                      <h3 className="font-bold text-slate-800 dark:text-white text-sm">Domain Breakdown</h3>
                    </div>
                    {/* Changed to Single Column (grid-cols-1) */}
                    <div className="p-4 grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {metrics.domain_counts && Object.entries(metrics.domain_counts).length > 0 ? (
                        Object.entries(metrics.domain_counts).map(([domain, count]) => (
                          <div key={domain} className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-100 dark:border-slate-600 px-3 py-2 rounded transition-colors">
                            <span className="text-xs text-slate-600 dark:text-gray-300 font-bold truncate max-w-[150px]" title={domain}>{domain}</span>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-800">{count}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-gray-500 text-center py-2">No domain data found.</p>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* Bottom Row: Full Student List with Pagination */}
              <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">All Students</h3>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                      Showing {filteredStudents.length} record(s) ordered by import
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Search Bar */}
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 w-64"
                      />
                    </div>
                    {/* Department Filter */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 transition-colors">
                      <button
                        onClick={() => {
                          setAllStudentsDeptFilter('all');
                          setCurrentPage(1);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${allStudentsDeptFilter === 'all'
                          ? 'text-white shadow-sm'
                          : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        style={allStudentsDeptFilter === 'all' ? { backgroundColor: '#AF69F8' } : {}}
                      >
                        All
                      </button>
                      <button
                        onClick={() => {
                          setAllStudentsDeptFilter('software');
                          setCurrentPage(1);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${allStudentsDeptFilter === 'software'
                          ? 'text-white shadow-sm'
                          : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        style={allStudentsDeptFilter === 'software' ? { backgroundColor: '#AF69F8' } : {}}
                      >
                        Software
                      </button>
                      <button
                        onClick={() => {
                          setAllStudentsDeptFilter('core');
                          setCurrentPage(1);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${allStudentsDeptFilter === 'core'
                          ? 'text-white shadow-sm'
                          : 'text-slate-600 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        style={allStudentsDeptFilter === 'core' ? { backgroundColor: '#AF69F8' } : {}}
                      >
                        Core
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-gray-400 font-semibold border-b border-slate-200 dark:border-slate-700 transition-colors">
                      <tr>
                        <th className="px-6 py-4 text-left">Roll Number</th>
                        <th className="px-6 py-4 text-left">Name</th>
                        <th className="px-6 py-4 text-left">Department</th>
                        <th className="px-6 py-4 text-left">Domain</th>
                        <th className="px-6 py-4 text-right">CGPA</th>
                        <th className="px-6 py-4 text-left">PS Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 transition-colors">
                      {paginatedStudents.length > 0 ? (
                        paginatedStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                            <td className="px-6 py-4 text-slate-500 dark:text-gray-400 font-mono text-xs align-middle bg-white dark:bg-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-700/50">{s.roll_no}</td>
                            <td className="px-6 py-4 align-middle">
                              <span className="font-semibold text-slate-800 dark:text-gray-200">{s.name}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-600 dark:text-gray-400 align-middle">{s.department}</td>
                            <td className="px-6 py-4 align-middle">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                                {s.domain || "General"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600 dark:text-gray-400 font-mono align-middle">{s.cgpa}</td>
                            <td className="px-6 py-4 text-left align-middle">
                              <div className="font-mono text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-xl border border-emerald-100 dark:border-emerald-800 w-fit max-w-[400px] overflow-x-auto whitespace-nowrap custom-scrollbar">
                                {s.skills_text || "-"}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="p-12 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-gray-500">
                              <p>No students found.</p>
                              <p className="text-sm mt-1">Upload a CSV or Excel file to populate the list.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Premium Pagination */}
                {students.length > 0 && (
                  <div className="p-6 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 transition-colors">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )
      }
    </div >
  );
}

export default StudentDashboardPage;