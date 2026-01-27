import { useState, useEffect, useRef } from "react";

function CsvEditor({ data, columns, onSave, onCancel, title, disableUppercase = false }) {
  const [editedData, setEditedData] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
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

  const handleDeleteRow = (rowIndex) => {
    if (window.confirm("Are you sure you want to delete this row?")) {
      const updated = editedData.filter((_, idx) => idx !== rowIndex);
      setEditedData(updated);
      setHasChanges(true);
    }
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
    <div className="bg-hb-card rounded-lg border border-gray-200 shadow-lg">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
        {hasChanges && (
          <p className="text-xs text-yellow-600 mt-2">⚠️ You have unsaved changes</p>
        )}
        {error && (
          <div className="mt-2 text-left">
            <p className="text-sm text-red-600 font-semibold flex items-center gap-2">
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
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {editedData.map((row, rowIndex) => (
              <tr
                key={row._id}
                data-index={rowIndex}
                className={`transition-colors ${rowIndex === errorRowIndex
                  ? 'bg-red-50 border-2 border-red-400'
                  : 'hover:bg-gray-50'
                  }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2">
                    <input
                      type={col.type || "text"}
                      value={row[col.key] || ""}
                      onChange={(e) => handleCellChange(rowIndex, col.key, e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={col.placeholder || ""}
                    />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleAddRow}
          className="px-4 py-2 text-white rounded-lg text-sm font-medium shadow-sm transition-all"
          style={{ background: 'linear-gradient(135deg, #6B64F2 0%, #8E5BF6 50%, #A656F7 100%)' }}
        >
          + Add New Row
        </button>
        <p className="text-xs text-gray-500 mt-2">
          Total rows: {editedData.length}
        </p>
      </div>
    </div>
  );
}

export default CsvEditor;


