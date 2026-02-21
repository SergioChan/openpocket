import imgShopping from "figma:asset/e10c4bacffedda0372207e483965410e75ec0563.png";
import imgSocial from "figma:asset/cf94a198a5b8389453fa60978b06c8fb41e5e43c.png";
import imgEntertainment from "figma:asset/ef5076fae78920ef490337fb490e77b047731670.png";
import imgAndMore from "figma:asset/f73f56fd308a692f93cf6f19633cc4b2497fe7fe.png";

export function UseCases() {
  const cases = [
    { icon: imgShopping, label: "Shopping" },
    { icon: imgSocial, label: "Social Workflows" },
    { icon: imgEntertainment, label: "Entertainment" },
    { icon: imgAndMore, label: "And More" },
  ];

  return (
    <section className="flex flex-col gap-4 w-full overflow-hidden">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] text-[18px] text-[#707070]">
        Use Cases
      </p>
      <div className="relative w-full">
        {/* Scrolling container */}
        <div className="flex gap-6 animate-scroll-infinite">
          {/* First set of cards */}
          {cases.map((useCase, index) => (
            <div
              key={`first-${index}`}
              className="bg-[rgba(111,111,111,0.06)] border border-[rgba(0,0,0,0.1)] rounded-[10px] px-8 py-4 flex items-center gap-3 shrink-0"
            >
              <div className="relative w-10 h-10 shrink-0">
                <img
                  src={useCase.icon}
                  alt={useCase.label}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-black whitespace-nowrap">
                {useCase.label}
              </span>
            </div>
          ))}
          {/* Duplicate set for seamless loop */}
          {cases.map((useCase, index) => (
            <div
              key={`second-${index}`}
              className="bg-[rgba(111,111,111,0.06)] border border-[rgba(0,0,0,0.1)] rounded-[10px] px-8 py-4 flex items-center gap-3 shrink-0"
            >
              <div className="relative w-10 h-10 shrink-0">
                <img
                  src={useCase.icon}
                  alt={useCase.label}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-black whitespace-nowrap">
                {useCase.label}
              </span>
            </div>
          ))}
          {/* Third set for extra smooth loop */}
          {cases.map((useCase, index) => (
            <div
              key={`third-${index}`}
              className="bg-[rgba(111,111,111,0.06)] border border-[rgba(0,0,0,0.1)] rounded-[10px] px-8 py-4 flex items-center gap-3 shrink-0"
            >
              <div className="relative w-10 h-10 shrink-0">
                <img
                  src={useCase.icon}
                  alt={useCase.label}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-black whitespace-nowrap">
                {useCase.label}
              </span>
            </div>
          ))}
        </div>

        {/* Gradient overlays for smooth fade */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
}