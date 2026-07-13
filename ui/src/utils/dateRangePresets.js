import moment from "moment";

// Shared "quick range" options for report-style filters (Purchases,
// Expenditures, ...) that default to the current month instead of loading
// every record ever entered. All ranges use dd-MM-yyyy to match the
// VueDatePicker fields and backend query params already in use.
export const DATE_RANGE_PRESETS = [
  { title: "Today", value: "today" },
  { title: "This Week", value: "this_week" },
  { title: "Last Week", value: "last_week" },
  { title: "This Month", value: "this_month" },
  { title: "Previous Month", value: "previous_month" },
  { title: "Custom", value: "custom" },
];

const FORMAT = "DD-MM-YYYY";

/**
 * Returns { from, to } strings in DD-MM-YYYY for a preset key, or null for
 * "custom" (meaning: leave whatever the user already has in place).
 */
export function getDateRangePreset(preset) {
  const today = moment();

  switch (preset) {
    case "today":
      return { from: today.format(FORMAT), to: today.format(FORMAT) };
    case "this_week":
      return {
        from: today.clone().startOf("isoWeek").format(FORMAT),
        to: today.clone().endOf("isoWeek").format(FORMAT),
      };
    case "last_week":
      return {
        from: today.clone().subtract(1, "week").startOf("isoWeek").format(FORMAT),
        to: today.clone().subtract(1, "week").endOf("isoWeek").format(FORMAT),
      };
    case "this_month":
      return {
        from: today.clone().startOf("month").format(FORMAT),
        to: today.clone().endOf("month").format(FORMAT),
      };
    case "previous_month":
      return {
        from: today.clone().subtract(1, "month").startOf("month").format(FORMAT),
        to: today.clone().subtract(1, "month").endOf("month").format(FORMAT),
      };
    default:
      return null;
  }
}
