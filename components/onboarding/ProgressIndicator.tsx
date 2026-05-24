type Props = {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
};

export function ProgressIndicator({ currentStep, totalSteps, labels }: Props) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-brand-gray-400">
        <span>
          Step {currentStep} of {totalSteps}
        </span>
        {labels && labels[currentStep - 1] ? (
          <span className="text-brand-orange">{labels[currentStep - 1]}</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const stepNum = idx + 1;
          const active = stepNum <= currentStep;
          return (
            <div
              key={stepNum}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                active ? "bg-brand-orange" : "bg-white/10"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
