import { useEffect } from "react";

function Notification({ message, type = "success", onClose, duration = 8000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getNotificationStyle = () => {
    switch (type) {
      case "success":
        return { bgColor: "bg-green-600", icon: "✅" };
      case "error":
        return { bgColor: "bg-red-600", icon: "❌" };
      case "warning":
        return { bgColor: "bg-yellow-500", icon: "⚠️" };
      case "info":
        return { bgColor: "bg-blue-600", icon: "ℹ️" };
      default:
        return { bgColor: "bg-gray-600", icon: "ℹ️" };
    }
  };

  const { bgColor, icon } = getNotificationStyle();

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]`}>
        <span className="text-xl">{icon}</span>
        <p className="flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 text-xl leading-none"
        >
          ×
        </button>
      </div>
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Notification;


