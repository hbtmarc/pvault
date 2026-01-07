import { useMonthContext } from "../state/MonthProvider";

export const useMonthKey = () => {
  return useMonthContext();
};
