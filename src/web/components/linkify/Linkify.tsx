import { Fragment } from 'react';
import { splitTextIntoSegments } from './splitTextIntoSegments';

interface Props {
  /**
   * Plain, user-authored text. Anything that is not a recognised link is
   * rendered verbatim — this is deliberately not a markdown renderer, so
   * characters like `*` and `#` keep their literal meaning.
   */
  text: string;
}

/**
 * Renders plain text, turning bare `https://` and `mailto:` addresses into
 * anchors. Do not use inside another `<a>`/`<Link>` — nested anchors are
 * invalid HTML.
 */
export function Linkify({ text }: Props) {
  return (
    <>
      {splitTextIntoSegments(text).map((segment, index) =>
        segment.kind === 'link' ? (
          <a
            key={index}
            href={segment.value}
            target="_blank"
            rel="noreferrer noopener"
            // break-words keeps a long address from overflowing its container
            // on narrow screens.
            className="cursor-pointer break-words text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
          >
            {segment.value}
          </a>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        )
      )}
    </>
  );
}
