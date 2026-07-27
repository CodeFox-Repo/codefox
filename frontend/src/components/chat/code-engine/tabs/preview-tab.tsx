'use client';
import WebPreview from '../web-view';

const PreviewTab = ({ project }: { project?: any }) => {
  return (
    <div className="h-full w-full">
      <WebPreview project={project} />
    </div>
  );
};

export default PreviewTab;
