export function AnimatedBackground() {
  return (
    <div className="animated-bg">
      <div className="circle-3 absolute w-[400px] h-[400px] top-1/2 left-1/3 opacity-[0.05]" 
        style={{ 
          background: 'radial-gradient(circle, hsl(204 93% 39%) 0%, transparent 70%)',
          animation: 'float-circle 30s ease-in-out infinite'
        }} 
      />
    </div>
  );
}
