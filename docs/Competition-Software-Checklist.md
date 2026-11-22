# Competition software checklist

## Before connecting power

- Confirm the Robot Configuration names match the Java hardware map.
- Verify motor and servo types and ports.
- Check motor direction with the drivetrain safely supported.
- Confirm servo endpoints do not force a mechanism against a hard stop.
- Confirm emergency stop and Driver Station connection behavior.

## Driver-controlled testing

- Start with low drive speed and test each direction separately.
- Verify forward, reverse, strafe, and rotation independently.
- Check that joystick deadbands prevent unwanted drift.
- Confirm all motors stop when the OpMode ends.
- Test each mechanism independently before combining controls.

## Autonomous testing

- Confirm start pose, heading, and field-side assumptions.
- Add timeouts and active-state checks to movement routines.
- Log target and measured values with telemetry.
- Run repeatability tests and record results.
- Keep a known-safe fallback routine.

## Release

- Compile against the team's installed FTC SDK version.
- Test on the actual Control Hub and Driver Station setup with team supervision.
- Record the version that was tested.
- Keep a known-good backup OpMode.
