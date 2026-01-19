function Button({ children, className = "", ...rest }) {
  return (
    <button
      className={`rounded bg-hb-primary px-4 py-2 text-sm font-medium hover:bg-blue-600 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;


