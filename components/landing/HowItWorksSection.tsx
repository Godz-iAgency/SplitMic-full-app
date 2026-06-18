import { Reveal } from "@/components/motion/Reveal";

const STEPS = [
  {
    number: "01",
    title: "Sign Up",
    description: "Create your free account in under 60 seconds.",
  },
  {
    number: "02",
    title: "Pick Your Role",
    description: "Choose your player type and build your industry profile.",
  },
  {
    number: "03",
    title: "Connect & Grow",
    description: "Discover, message, post opportunities, and grow your network.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-brand-gray-800 bg-black px-6 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-14 text-center">
          <h2 className="text-3xl font-black sm:text-5xl">
            Get started in <span className="text-brand-orange">3 steps</span>
          </h2>
        </Reveal>

        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 0.12} className="text-center">
              <div className="mb-4 text-5xl font-black text-brand-orange/30">
                {step.number}
              </div>
              <h3 className="text-2xl font-bold text-white">{step.title}</h3>
              <p className="mt-3 text-base text-brand-gray-300">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
