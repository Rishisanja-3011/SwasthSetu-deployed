import React from 'react';
import { UserCheck, Cpu, ClipboardCheck, Send, Lock } from 'lucide-react';

export default function WorkflowStepper({ currentStep, setStep, grantStatus, hasReport, isPublished }) {
  const steps = [
    { id: 1, title: 'Dashboard & Worklist', icon: <UserCheck size={16} /> },
    { id: 2, title: 'Patient Verification', icon: <UserCheck size={16} /> },
    { id: 3, title: 'CBC Generation & Extraction', icon: <Cpu size={16} /> },
    { id: 4, title: 'Review & Normalization', icon: <ClipboardCheck size={16} /> },
    { id: 5, title: 'Publish & Expire Access', icon: isPublished ? <Lock size={16} /> : <Send size={16} /> },
  ];

  return (
    <div className="workflow-stepper">
      {steps.map((s, idx) => {
        const isActive = currentStep === s.id;
        const isCompleted = currentStep > s.id;

        return (
          <React.Fragment key={s.id}>
            <div
              className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              onClick={() => {
                // Only allow navigating if prerequisites met
                if (s.id === 1 || s.id === 2) setStep(s.id);
                else if (s.id === 3 && (hasReport || isCompleted)) setStep(s.id);
                else if (s.id === 4 && hasReport) setStep(s.id);
                else if (s.id === 5 && (hasReport || isPublished)) setStep(s.id);
              }}
            >
              <div className="step-num">{s.id}</div>
              <div className="step-label">{s.title}</div>
            </div>
            {idx < steps.length - 1 && <div className="step-divider" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
