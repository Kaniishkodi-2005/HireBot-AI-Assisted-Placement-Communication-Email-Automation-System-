import { useState, useEffect } from "react";
import { fetchTemplates } from "../services/hrService";

function TemplateSelectionModal({ contact, onClose, onTemplateSelect, onCreateTemplate, onDeleteTemplate }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);

  const templates = [
    {
      id: "final_year_students",
      title: "Final Year Students Information",
      description: "Share details about graduating students available for placement",
      icon: "🎓"
    },
    {
      id: "internship_opportunities",
      title: "Internship Opportunities",
      description: "Discuss internship programs for current students",
      icon: "💼"
    }
  ];

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  // Add a prop to trigger refresh
  useEffect(() => {
    if (contact) {
      loadCustomTemplates();
    }
  }, [contact]);

  const loadCustomTemplates = async () => {
    try {
      const templates = await fetchTemplates();
      setCustomTemplates(templates);
    } catch (error) {
      console.error('Failed to load custom templates:', error);
    }
  };

  const handleTemplateSelect = async (template) => {
    setSelectedTemplate(template.id);
    setLoading(true);

    try {
      await onTemplateSelect(template);
      // Don't call onClose() here - let the parent handle the modal transition
    } catch (error) {
      console.error("Failed to generate draft:", error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Select Email Template</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a template for {contact?.company}</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              disabled={loading}
              className={`w-full text-left p-4 rounded-lg border transition-all ${selectedTemplate === template.id
                  ? "border-purple-500 bg-purple-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{template.icon}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800 text-sm">{template.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                </div>
                {loading && selectedTemplate === template.id && (
                  <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                )}
              </div>
            </button>
          ))}

          {customTemplates.length > 0 && (
            <>
              <div className="border-t border-slate-200 pt-3 mt-4">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Custom Templates</p>
                {customTemplates.map((template) => (
                  <div key={`custom-${template.id}`} className="relative">
                    <button
                      onClick={() => handleTemplateSelect({ id: `custom-${template.id}`, ...template })}
                      disabled={loading}
                      className={`w-full text-left p-4 rounded-lg border transition-all mb-2 ${selectedTemplate === `custom-${template.id}`
                          ? "border-purple-500 bg-purple-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">📝</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-purple-600 text-sm">{template.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{template.subject}</p>
                        </div>
                        {loading && selectedTemplate === `custom-${template.id}` && (
                          <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this template?')) {
                          await onDeleteTemplate(template.id);
                          loadCustomTemplates(); // Refresh the list
                        }
                      }}
                      className="absolute top-1/2 right-2 transform -translate-y-1/2 text-red-500 hover:text-red-700 p-1"
                      title="Delete template"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-t border-slate-200 pt-3 mt-4">
            <button
              onClick={onCreateTemplate}
              disabled={loading}
              className="w-full text-left p-4 rounded-lg border border-dashed border-slate-300 hover:border-purple-400 hover:bg-purple-50 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">➕</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-600 text-sm">Create New Template</h4>
                  <p className="text-xs text-slate-500 mt-1">Design a custom email template</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-500 text-center">
            🤖 HireBot AI assists with professional communication - Human approval ensures quality
          </p>
        </div>
      </div>
    </div>
  );
}

export default TemplateSelectionModal;