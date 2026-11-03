import { IsIn } from 'class-validator';
import { STALE_MARKER_DECISIONS } from '../services/stale-marker.service';

export class ResolveStaleMarkerDto {
  @IsIn(STALE_MARKER_DECISIONS)
  decision: string;
}
