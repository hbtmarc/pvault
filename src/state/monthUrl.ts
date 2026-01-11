import { type SetURLSearchParams } from "react-router-dom";

export const setMonthInSearchParams = (
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
  nextMonthKey: string
) => {
  const next = new URLSearchParams(searchParams);
  next.set("m", nextMonthKey);

  if (next.toString() === searchParams.toString()) {
    return;
  }

  setSearchParams(next, { replace: true });
};
