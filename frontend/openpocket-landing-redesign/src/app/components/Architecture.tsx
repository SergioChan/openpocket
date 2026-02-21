export function Architecture() {
  const nodes = [
    { label: "User", type: "gray" },
    { label: "OpenPocket Runtime", type: "blue" },
    { label: "Agent", type: "orange" },
    { 
      label: "ADB Runtime\nLocal Artifacts", 
      type: "blue-stack",
      isDouble: true 
    },
    { label: "Android Emulator", type: "gray" },
  ];

  return (
    <section className="flex flex-col gap-10 w-full">
      <p className="capitalize font-['Poppins:Regular',sans-serif] leading-[22px] text-[18px] text-[#707070]">
        Architecture
      </p>
      
      <div className="flex items-center justify-between gap-4 w-full">
        {nodes.map((node, index) => (
          <div key={index} className="flex items-center gap-4">
            {node.isDouble ? (
              <div className="flex flex-col gap-3">
                <div className="bg-[rgba(43,127,255,0.1)] border border-[#2b7fff] rounded-[8px] px-10 py-3 h-[46px] flex items-center justify-center">
                  <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-[#2b7fff] whitespace-nowrap">
                    ADB Runtime
                  </span>
                </div>
                <div className="bg-[rgba(43,127,255,0.1)] border border-[#2b7fff] rounded-[8px] px-10 py-3 flex items-center justify-center">
                  <span className="font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] text-[#2b7fff] whitespace-nowrap">
                    Local Artifacts
                  </span>
                </div>
              </div>
            ) : (
              <div
                className={`
                  ${node.type === "gray" ? "bg-[rgba(111,111,111,0.06)] border-[rgba(0,0,0,0.1)]" : ""}
                  ${node.type === "blue" ? "bg-[rgba(43,127,255,0.1)] border-[#2b7fff]" : ""}
                  ${node.type === "orange" ? "bg-[rgba(255,138,0,0.1)] border-[#ff8a00]" : ""}
                  border rounded-[8px] px-10 py-3 h-[46px] flex items-center justify-center
                `}
              >
                <span
                  className={`
                    font-['Poppins:Medium',sans-serif] text-[16px] leading-[24px] whitespace-nowrap
                    ${node.type === "gray" ? "text-black" : ""}
                    ${node.type === "blue" ? "text-[#2b7fff]" : ""}
                    ${node.type === "orange" ? "text-[#ff8a00]" : ""}
                  `}
                >
                  {node.label}
                </span>
              </div>
            )}
            
            {index < nodes.length - 1 && (
              <span className="font-['Inter:Regular',sans-serif] text-[16px] text-[#707070]">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}