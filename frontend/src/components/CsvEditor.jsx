import { useState, useEffect, useRef } from "react";

function CsvEditor({ data, columns, onSave, onCancel, title, disableUppercase = false }) {
  const [editedData, setEditedData] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const tableContainerRef = useRef(null);

  useEffect(() => {
    // Convert data to editable format
    const formatted = data.map((row, idx) => ({
      _id: idx,
      ...row
    }));
    setEditedData(formatted);
  }, [data]);

  const handleCellChange = (rowIndex, column, value) => {
    const colLower = column.toLowerCase();
    let newValue = value;

    // Global Uppercase for text fields (exclude email and cgpa)
    if (!disableUppercase && colLower !== 'email' && colLower !== 'cgpa') {
      newValue = newValue.toUpperCase();
    }

    // Specific Validations

    // 1. Name: Letters and spaces only
    if (colLower === 'name') {
      if (!/^[a-zA-Z\s]*$/.test(newValue)) return;
    }

    // 2. Department, Domain, Company: No numbers allowed
    if (['department', 'domain', 'company'].includes(colLower)) {
      if (/\d/.test(newValue)) return;
    }

    // 3. CGPA: Numbers and dots only
    if (colLower === 'cgpa') {
      if (!/^[0-9.]*$/.test(newValue)) return;
    }

    const updated = [...editedData];
    updated[rowIndex] = {
      ...updated[rowIndex],
      [column]: newValue
    };
    setEditedData(updated);
    setHasChanges(true);
  };

  const handleAddRow = () => {
    const newRow = {};
    columns.forEach(col => {
      newRow[col.key] = "";
    });
    // Use Date.now() for unique key
    newRow._id = Date.now();

    // Append to bottom instead of top
    setEditedData([...editedData, newRow]);
    setHasChanges(true);

    // Auto-scroll to bottom
    setTimeout(() => {
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollTo({
          top: tableContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;

    if (window.confirm(`Are you sure you want to delete ${selectedRows.size} selected row(s)?`)) {
      const updated = editedData.filter(row => !selectedRows.has(row._id));
      setEditedData(updated);
      setSelectedRows(new Set());
      setHasChanges(true);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(editedData.map(row => row._id));
      setSelectedRows(allIds);
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const [error, setError] = useState("");
  const [errorRowIndex, setErrorRowIndex] = useState(-1);

  const handleSave = () => {
    setError("");
    setErrorRowIndex(-1);

    // Validation: Check for empty fields
    for (let i = 0; i < editedData.length; i++) {
      const row = editedData[i];
      for (const col of columns) {
        const val = row[col.key];

        // Empty check
        if (!val || val.toString().trim() === "") {
          setError(`Please fill all required fields!`);
          setErrorRowIndex(i);

          if (tableContainerRef.current) {
            const rowElement = tableContainerRef.current.querySelector(`tr[data-index="${i}"]`);
            if (rowElement) {
              rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
          return;
        }

        // Email check
        const colLower = col.key.toLowerCase();
        if ((colLower === 'email' || col.type === 'email') && !val.toString().includes('@')) {
          setError(`Please enter valid email addresses!`);
          setErrorRowIndex(i);

          if (tableContainerRef.current) {
            const rowElement = tableContainerRef.current.querySelector(`tr[data-index="${i}"]`);
            if (rowElement) {
              rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
          return;
        }
      }
    }

    // Remove _id from data before saving
    const dataToSave = editedData.map(({ _id, ...rest }) => rest);
    onSave(dataToSave);
    setHasChanges(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-200">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl transition-colors duration-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
              style={{ backgroundColor: '#AF69F8' }}
            >
              Save Changes
            </button>
            {selectedRows.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected ({selectedRows.size})
              </button>
            )}
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
        {hasChanges && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">⚠️ You have unsaved changes</p>
        )}
        {error && (
          <div className="mt-2 text-left">
            <p className="text-sm text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
              ❌ {error}
            </p>
          </div>
        )}
      </div>

      <div
        ref={tableContainerRef}
        className="overflow-x-auto max-h-[70vh]"
      >
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 transition-colors duration-200">
            <tr>
              <th className="px-6 py-4 text-left w-12 border-b border-slate-200 dark:border-slate-700"></th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 transition-colors duration-200">
            {editedData.map((row, rowIndex) => (
              <tr
                key={row._id}
                data-index={rowIndex}
                className={`group transition-all duration-200 ${rowIndex === errorRowIndex
                  ? 'bg-red-50/50 dark:bg-red-900/10'
                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/30'
                  }`}
              >
                <td className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row._id)}
                    onChange={() => handleSelectRow(row._id)}
                    className="rounded border-gray-300 dark:border-slate-600 dark:bg-slate-900 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                  />
                </td>
                {columns.map((col) => (
                  <td key={col.key} className="px-2 py-1">
                    <input
                      type={col.type || "text"}
                      value={row[col.key] || ""}
                      onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                      className={`w-full bg-white dark:bg-slate-900/50 border rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition-all placeholder-slate-300 dark:placeholder-slate-600 outline-none
                          ${rowIndex === errorRowIndex
                          ? 'border-red-200 dark:border-red-800'
                          : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 focus:shadow-md'}`}
                      placeholder={col.placeholder || `Enter ${col.label.toLowerCase()}...`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-xl transition-colors duration-200">
        <button
          onClick={handleAddRow}
          className="px-4 py-2 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
          style={{ backgroundColor: '#AF69F8' }}
        >
          + Add New Row
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Total rows: {editedData.length}
        </p>
      </div>
    </div>
  );
}

export default CsvEditor;


