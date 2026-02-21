export function SimpleWorkflow() {
  const steps = [
    {
      number: "1",
      title: "Ask",
      description: "Initiate via CLI, local panel, or custom bot.",
    },
    {
      number: "2",
      title: "Plan",
      description: "Agent chooses the next mobile action.",
    },
    {
      number: "3",
      title: "Act",
      description: "OpenPocket executes on your local emulator.",
    },
  ];

  return (
    <section className="flex flex-col gap-4 w-full">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] text-[18px] text-[#707070]">
        Simple Workflow, Powerful Results
      </p>
      <div className="flex gap-12 py-10 w-full">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col gap-6 pl-6 border-l border-[#ff8a00] flex-1">
            <div className="flex flex-col gap-2">
              <p className="font-['Poppins:Medium',sans-serif] leading-[28px] text-[32px] text-[#ff8a00]">
                {step.number}
              </p>
              <h3 className="font-['Poppins:Medium',sans-serif] leading-[64px] text-[56px] text-[#ff8a00]">
                {step.title}
              </h3>
            </div>
            <p className="font-['Poppins:Regular',sans-serif] leading-[20px] text-[14px] text-black">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}