import * as React from "react";
import { Switch as HeadlessSwitch } from "@headlessui/react";
import { motion } from "motion/react";
import { cn } from "./utils";

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children" | "className" | "value"> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  className?: string;
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
    <HeadlessSwitch as="button"
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onChange={handleChange}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={({ checked: isChecked }: { checked: boolean }) => cn("bo-sc-switch", isChecked && "is-checked", className)}
      {...rest}
    >
      {({ checked: isChecked }) => (
        <>
          <motion.span
            className="bo-sc-switchThumb"
            data-state={isChecked ? "checked" : "unchecked"}
            data-slot="switch-thumb"
            animate={pressed ? { width: pressedWidth } : { width: 18 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            {thumbIcon ? (
              <motion.span className="bo-sc-switchThumbIcon" data-slot="switch-thumb-icon" animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0 }}>
                {thumbIcon}
              </motion.span>
            ) : null}
          </motion.span>

          {startIcon ? (
            <motion.span
              className="bo-sc-switchIcon bo-sc-switchIcon--left"
              data-slot="switch-icon-start"
              animate={isChecked ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              transition={{ type: "spring", bounce: 0 }}
            >
              {startIcon}
            </motion.span>
          ) : null}

          {endIcon ? (
            <motion.span
              className="bo-sc-switchIcon bo-sc-switchIcon--right"
              data-slot="switch-icon-end"
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
