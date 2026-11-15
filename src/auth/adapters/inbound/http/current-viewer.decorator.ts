import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Viewer } from '../../../../shared/viewer';
import { ViewerRequest } from './resolve-viewer.guard';

/**
 * Returns the viewer resolved by ResolveViewerGuard.
 * If it is missing, the guard is not registered: that is a programming error (500).
 */
export const CurrentViewer = createParamDecorator((_data: unknown, context: ExecutionContext): Viewer => {
  const request = context.switchToHttp().getRequest<ViewerRequest>();
  if (!request.viewer) {
    throw new Error('Viewer not resolved: ResolveViewerGuard is not registered');
  }
  return request.viewer;
});
