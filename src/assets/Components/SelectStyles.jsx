/* =============================================
   SHARED REACT-SELECT STYLES
   Used by the react-select / CreatableSelect
   pickers in the reservation form so they all
   look consistent.
============================================= */
export const selectStyles = {
    control: (base) => ({
        ...base,
        borderRadius: "0.25rem",
        borderColor: "#d1d5db",
        minHeight: "42px",
        boxShadow: "none",
        "&:hover": { borderColor: "#000" }
    }),
    menu: (base) => ({
        ...base,
        zIndex: 9999
    }),
    option: (base, state) => ({
        ...base,
        fontSize: "0.875rem",
        backgroundColor: state.isFocused ? "#f3f4f6" : "white",
        color: "#111827"
    }),
    placeholder: (base) => ({
        ...base,
        fontSize: "0.875rem",
        color: "#9ca3af"
    }),
    singleValue: (base) => ({
        ...base,
        fontSize: "0.875rem"
    })
};

export default selectStyles;
