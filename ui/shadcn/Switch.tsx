import * as React from "react";
import { Switch as HeadlessSwitch } from "@headlessui/react";
import { motion } from "motion/react";

type HeadlessSwitchProps = React.ComponentProps<typeof HeadlessSwitch>;

type SwitchProps = Omit<HeadlessSwitchProps, "onChange" | "children"> & {
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  pressedWidth?: number;
  startIcon?: React.ReactElement;
  endIcon?: React.ReactElement;
  thumbIcon?: React.ReactElement;
};

export function Switch({
  className = "",
  checked,
  defaultChecked,
  disabled,
  onCheckedChange,
  onChange,
  pressedWidth = 19,
  startIcon,
  endIcon,
  thumbIcon,
  ...rest
}: SwitchProps) {
  const [pressed, setPressed] = React.useState(false);

  const handleChange = React.useCallback(
    (nextChecked: boolean) => {
      onCheckedChange?.(nextChecked);
      onChange?.(nextChecked);
    },
    [onChange, onCheckedChange],
  );

  return (
    <HeadlessSwitch
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onChange={handleChange}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={({ checked: isChecked }: { checked: boolean }) => [
          "w-11 h-6 rounded-full border border-border bg-white/[0.08] relative p-0 cursor-pointer transition-colors duration-160 ease",
          isChecked ? "bg-primary/24 border-primary/50" : "",
          disabled ? "opacity-55 cursor-not-allowed" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      {...rest}
    >
      {({ checked: isChecked }) => (
        <>
          <motion.span
            className="block w-[18px] h-[18px] rounded-full bg-white/[0.95] shadow-[0_2px_10px_rgba(0,0,0,0.32)] absolute top-0.5 left-0.5 translate-x-0 transition-transform duration-160 ease will-change-transform"
            data-state={isChecked ? "checked" : "unchecked"}
            animate={pressed ? { width: pressedWidth, translateX: isChecked ? 20 - (pressedWidth - 18) : 0 } : { width: 18, translateX: isChecked ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {thumbIcon ? (
              <motion.span className="absolute inset-0 inline-flex items-center justify-center text-white/42 pointer-events-none" animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0 }}>
                {thumbIcon}
              </motion.span>
            ) : null}
          </motion.span>

          {startIcon ? (
            <motion.span
              className="absolute top-1/2 -translate-y-1/2 left-0.5 inline-flex items-center justify-center text-white/50 pointer-events-none"
              animate={isChecked ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              transition={{ type: "spring", bounce: 0 }}
            >
              {startIcon}
            </motion.span>
          ) : null}

          {endIcon ? (
            <motion.span
              className="absolute top-1/2 -translate-y-1/2 right-0.5 inline-flex items-center justify-center text-white/50 pointer-events-none"
              animate={!isChecked ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              transition={{ type: "spring", bounce: 0 }}
            >
              {endIcon}
            </motion.span>
          ) : null}
        </>
      )}
    </HeadlessSwitch>
  );
}
