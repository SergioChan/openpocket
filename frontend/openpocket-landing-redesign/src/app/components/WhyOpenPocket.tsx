export function WhyOpenPocket() {
  const features = [
    {
      title: "Local Runtime",
      description: "Execute mobile workflows on your own machine. No expensive cloud subscriptions, no data leaks.",
    },
    {
      title: "Human + Agent",
      description: "The perfect hybrid. Manual control when you want it, agent automation when you don't.",
    },
    {
      title: "Auditable & Private",
      description: "All sessions and memory stay visible and local. Your data, your rules.",
    },
  ];

  return (
    <section className="flex flex-col gap-4 w-full">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] text-[18px] text-[#707070]">
        Why OpenPocket?
      </p>
      <div className="flex gap-12 w-full">
        {features.map((feature, index) => (
          <div key={index} className="flex flex-col gap-6 py-10 flex-1">
            <h3 className="font-['Poppins:Medium',sans-serif] leading-[28px] text-[32px] text-[#ff8a00]">
              {feature.title}
            </h3>
            <p className="font-['Poppins:Regular',sans-serif] leading-[20px] text-[14px] text-black">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}