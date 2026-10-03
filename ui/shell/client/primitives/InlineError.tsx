// InlineError (SKILL.md section 7 error pattern, Canon s9): What failed, Why, Fix, three lines with a 2 px error
// rule on the left. What is Body 700 in the error colour; Why and Fix are Body 400 in ink; the Fix may carry the
// one action. Copy comes from the caller (client/copy.ts), never invented here.
import type { ReactNode } from 'react';

export type InlineErrorProps = {
  what: string;
  why: string;
  fix: string;
  action?: ReactNode;
};

export function InlineError({ what, why, fix, action }: InlineErrorProps) {
  return (
    <div className="inline-error">
      <p className="ie-what">{what}</p>
      <p className="ie-why">{why}</p>
      <p className="ie-fix">{fix}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
