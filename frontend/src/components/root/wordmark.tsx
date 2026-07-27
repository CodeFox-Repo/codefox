import { FoxMark } from './fox-mark';

/**
 * The one wordmark. Nav and sidebar used to render it differently — mono
 * terminal prompt in one, sans title in the other — which read as two brands.
 */
export function Wordmark({
  markClassName = 'h-5 w-5',
  gapClassName = 'ml-2',
  className = '',
}: {
  markClassName?: string;
  /** Space between mark and text — kept tunable so the sidebar can line the
   *  wordmark up with the icon rail below it. */
  gapClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <FoxMark className={`${markClassName} shrink-0 text-foreground`} />
      <span className={`${gapClassName} font-mono text-sm`}>
        <span className="pr-[0.4ch] text-primary">$</span>
        <span className="font-bold text-foreground">codefox</span>
        <span className="cursor-animation ml-[0.4ch] inline-block w-[1ch] text-primary">
          _
        </span>
      </span>
    </span>
  );
}
