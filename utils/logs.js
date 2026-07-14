/* ==================== LOGS ==================== */

export const getChangedBy = (user) => {
    if (!user) return "unknown";
    return (
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.email ||
        "unknown"
    );
};

export const createLogs = (existing, updates, user) => {
    const logs = [];

    Object.keys(updates).forEach((key) => {
        // skip nested pricing (important)
        if (key === "pricing") return;
        // skip internal bookkeeping — not dispatcher-visible fields
        if (key === "assignedBy") return;
        if (key === "tripDurationMinutes") return;
        if (key === "estimatedDropoff") return;

        const oldVal = existing[key];
        const newVal = updates[key];

        if (
            newVal !== undefined &&
            String(oldVal ?? "") !== String(newVal ?? "")
        ) {
            logs.push({
                field: key,
                oldValue: String(oldVal ?? ""),
                newValue: String(newVal ?? ""),
                changedBy: getChangedBy(user),
                timestamp: new Date()
            });
        }
    });

    return logs;
};
