'use client';
import WebPreview from '../web-view';
import { Dispatch, SetStateAction } from 'react';

interface PreviewTabProps {
  isInspectMode: boolean;
  setIsInspectMode: Dispatch<SetStateAction<boolean>>;
}

const PreviewTab = ({ isInspectMode, setIsInspectMode }: PreviewTabProps) => {
  return (
    <div className="w-full h-full">
      <WebPreview isInspectMode={isInspectMode} setIsInspectMode={setIsInspectMode} />
    </div>
  );
};

export default PreviewTab;
