import React from 'react';

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-6 py-8 w-full">
      {/* Previous Button */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={`
          relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 border
          ${currentPage === 1
            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
            : 'bg-white text-slate-500 border-slate-200 hover:bg-[#6B64F2] hover:text-white hover:border-[#6B64F2] hover:shadow-lg hover:-translate-y-1 active:scale-95 shadow-sm'
          }
        `}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Page Numbers */}
      <div className="flex items-center gap-3">
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="text-slate-300 font-bold px-2 text-lg">...</span>
            ) : (
              <div
                onClick={() => onPageChange(page)}
                className="relative flex items-center justify-center w-10 h-10 cursor-pointer group"
              >
                {/* Hover Background (Inactive only) - Fade in scale effect */}
                <div
                  className={`
                    absolute inset-0 bg-slate-100 rounded-lg transform transition-all duration-300 ease-out
                    ${currentPage === page
                      ? 'opacity-0 scale-50'
                      : 'opacity-0 group-hover:opacity-100 scale-100'
                    }
                  `}
                />

                {/* Active Diamond Background - Rotate and Scale Animation */}
                <div
                  className={`
                    absolute inset-0 bg-gradient-to-br from-[#6B64F2] via-[#8E5BF6] to-[#A656F7]
                    rounded-[10px] shadow-[0_8px_20px_-4px_rgba(135,92,246,0.5)]
                    transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) origin-center
                    ${currentPage === page
                      ? 'opacity-100 rotate-45 scale-100'
                      : 'opacity-0 rotate-0 scale-50'
                    }
                  `}
                />

                {/* Number Text */}
                <span
                  className={`
                    relative z-10 font-bold text-sm transition-colors duration-300
                    ${currentPage === page
                      ? 'text-white'
                      : 'text-slate-500 group-hover:text-[#6B64F2]'
                    }
                  `}
                >
                  {page}
                </span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Next Button */}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={`
          relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 border
          ${currentPage === totalPages
            ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
            : 'bg-[#6B64F2] text-white border-[#6B64F2] shadow-md hover:bg-[#5a52e0] hover:border-[#5a52e0] hover:shadow-lg hover:-translate-y-1 active:scale-95'
          }
        `}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

export default Pagination;
