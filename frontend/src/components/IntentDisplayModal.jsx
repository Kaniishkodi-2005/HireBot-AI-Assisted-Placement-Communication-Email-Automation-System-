import React, { useEffect, useState } from 'react';

export default function IntentDisplayModal({ intent, contact, onClose }) {

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!intent) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background backdrop */}
      <div
        className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Modal panel centering */}
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 sm:mx-0 sm:h-10 sm:w-10">
                <span className="text-xl">🧠</span>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  AI Extracted Intent
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Analysis for {contact?.company}
                </p>

                <div className="mt-4 space-y-4">
                  {/* Role & urgency */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Role</span>
                      <p className="text-sm font-medium text-gray-900">{intent.role || "Not specified"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Urgency</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${intent.urgency === 'high' ? 'bg-red-100 text-red-800' :
                        intent.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                        {intent.urgency?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Required Skills</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {intent.skills && intent.skills.length > 0 ? (
                        intent.skills.map((skill, idx) => {
                          const skillMap = {
                            'CLOUD': 'CLOUD COMPUTING',
                            'FULL STACK': 'FULL STACK DEVELOPMENT',
                            'FULLSTACK': 'FULL STACK DEVELOPMENT',
                            'AI': 'ARTIFICIAL INTELLIGENCE',
                            'ML': 'MACHINE LEARNING',
                            'DS': 'DATA SCIENCE',
                            'WEB': 'WEB DEVELOPMENT',
                            'MOBILE': 'MOBILE APP DEVELOPMENT',
                            'ANDROID': 'ANDROID DEVELOPMENT',
                            'IOS': 'IOS DEVELOPMENT',
                            'AWS': 'AMAZON WEB SERVICES (AWS)',
                            'AZURE': 'MICROSOFT AZURE',
                            'QA': 'QUALITY ASSURANCE',
                            'CYBER': 'CYBER SECURITY',
                            'UI/UX': 'UI/UX DESIGN',
                            'REACT': 'REACT.JS',
                            'NODE': 'NODE.JS'
                          };

                          const upperSkill = skill.toUpperCase();
                          const displaySkill = skillMap[upperSkill] || upperSkill;

                          return (
                            <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {displaySkill}
                            </span>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-400 italic">No specific skills detected</p>
                      )}
                    </div>
                  </div>

                  {/* Key Dates & Counts */}
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Positions</span>
                      <p className="text-sm font-bold text-gray-900">{intent.positions_count || "-"}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500">Visit Date</span>
                      <p className="text-sm font-bold text-purple-700">{intent.visit_date || "-"}</p>
                    </div>
                  </div>

                  {/* Commitments */}
                  {intent.commitments && intent.commitments.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Commitments</span>
                      <ul className="mt-1 list-disc list-inside text-sm text-gray-700">
                        {intent.commitments.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {intent.action_items && intent.action_items.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3">
                      <span className="text-xs font-semibold text-amber-800 uppercase">Action Items</span>
                      <ul className="mt-1 list-disc list-inside text-sm text-amber-900">
                        {intent.action_items.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
