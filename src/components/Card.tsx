import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

const Card = ({ children, className }: CardProps) => {
  return (
    <div
      className={`rounded-2xl border border-white/60 bg-white/80 p-6 shadow-lg shadow-slate-200/70 backdrop-blur ${
        className ?? ""
      }`}
    >
      {children}
    </div>
  );
};

export default Card;
