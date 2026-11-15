import { Star } from 'lucide-react';
import { useFeedbackCopy } from './copy';
import './feedback.css';

/** Zero to five score stars, announced as one image. */
export function Stars({ count, size = 16 }: { count: number; size?: number }) {
  const fc = useFeedbackCopy(), value = Math.max(0, Math.min(5, Math.round(Number.isFinite(count) ? count : 0)));
  return <span className="fb-stars" role="img" aria-label={fc('stars', { count: value })}>{[0, 1, 2, 3, 4].map(index => <Star key={index} size={size} aria-hidden="true" className={index < value ? 'fb-star-on' : 'fb-star-off'}/>)}</span>;
}
