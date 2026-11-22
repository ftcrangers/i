package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name = "Mecanum Adjustable Drive", group = "Rangers")
public class MecanumAdjustableDrive extends LinearOpMode {
    private DcMotor frontLeft;
    private DcMotor frontRight;
    private DcMotor backLeft;
    private DcMotor backRight;

    @Override
    public void runOpMode() {
        frontLeft = hardwareMap.get(DcMotor.class, "frontLeft");
        frontRight = hardwareMap.get(DcMotor.class, "frontRight");
        backLeft = hardwareMap.get(DcMotor.class, "backLeft");
        backRight = hardwareMap.get(DcMotor.class, "backRight");

        frontLeft.setDirection(DcMotor.Direction.REVERSE);
        backLeft.setDirection(DcMotor.Direction.REVERSE);

        frontLeft.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        frontRight.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        backLeft.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        backRight.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);

        waitForStart();

        try {
            while (opModeIsActive()) {
                double forward = -gamepad1.left_stick_y;
                double strafe = gamepad1.left_stick_x;
                double turn = gamepad1.right_stick_x;

                if (Math.abs(forward) < 0.04) forward = 0;
                if (Math.abs(strafe) < 0.04) strafe = 0;
                if (Math.abs(turn) < 0.04) turn = 0;

                double frontLeftPower = forward + strafe + turn;
                double backLeftPower = forward - strafe + turn;
                double frontRightPower = forward - strafe - turn;
                double backRightPower = forward + strafe - turn;

                double denominator = Math.max(1.0, Math.max(Math.max(Math.abs(frontLeftPower), Math.abs(backLeftPower)), Math.max(Math.abs(frontRightPower), Math.abs(backRightPower))));
                frontLeftPower /= denominator;
                backLeftPower /= denominator;
                frontRightPower /= denominator;
                backRightPower /= denominator;

                double triggerScale = 0.35 + (gamepad1.right_trigger * 0.65);
                double speedScale = gamepad1.left_bumper ? 0.25 : triggerScale;

                frontLeft.setPower(frontLeftPower * speedScale);
                backLeft.setPower(backLeftPower * speedScale);
                frontRight.setPower(frontRightPower * speedScale);
                backRight.setPower(backRightPower * speedScale);

                telemetry.addData("Speed", "%.0f%%", speedScale * 100);
                telemetry.addData("Forward", "%.2f", forward);
                telemetry.addData("Strafe", "%.2f", strafe);
                telemetry.addData("Turn", "%.2f", turn);
                telemetry.addData("FL / FR", "%.2f / %.2f", frontLeftPower, frontRightPower);
                telemetry.addData("BL / BR", "%.2f / %.2f", backLeftPower, backRightPower);
                telemetry.update();
            }
        } finally {
            stopDrive();
        }
    }

    private void stopDrive() {
        if (frontLeft != null) frontLeft.setPower(0);
        if (frontRight != null) frontRight.setPower(0);
        if (backLeft != null) backLeft.setPower(0);
        if (backRight != null) backRight.setPower(0);
    }
}