package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "Into The Deep TeleOp", group = "Rangers Seasons")
public class IntoTheDeepTeleOp extends LinearOpMode {
    private DcMotor frontLeft;
    private DcMotor frontRight;
    private DcMotor backLeft;
    private DcMotor backRight;
    private DcMotor lift;
    private DcMotor intake;
    private Servo claw;
    private boolean clawClosed;
    private boolean lastClawButton;

    @Override
    public void runOpMode() {
        frontLeft = hardwareMap.get(DcMotor.class, "frontLeft");
        frontRight = hardwareMap.get(DcMotor.class, "frontRight");
        backLeft = hardwareMap.get(DcMotor.class, "backLeft");
        backRight = hardwareMap.get(DcMotor.class, "backRight");
        lift = hardwareMap.get(DcMotor.class, "lift");
        intake = hardwareMap.get(DcMotor.class, "intake");
        claw = hardwareMap.get(Servo.class, "claw");

        frontLeft.setDirection(DcMotor.Direction.REVERSE);
        backLeft.setDirection(DcMotor.Direction.REVERSE);
        lift.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        claw.setPosition(0.3);

        waitForStart();

        try {
            while (opModeIsActive()) {
                driveRobot();
                lift.setPower(-gamepad2.left_stick_y * 0.55);
                intake.setPower(gamepad2.right_trigger - gamepad2.left_trigger);
                if (gamepad2.a && !lastClawButton) {
                    clawClosed = !clawClosed;
                    claw.setPosition(clawClosed ? 0.72 : 0.3);
                }
                lastClawButton = gamepad2.a;
                telemetry.addData("Lift", lift.getCurrentPosition());
                telemetry.addData("Claw", clawClosed ? "Closed" : "Open");
                telemetry.update();
            }
        } finally {
            frontLeft.setPower(0);
            frontRight.setPower(0);
            backLeft.setPower(0);
            backRight.setPower(0);
            lift.setPower(0);
            intake.setPower(0);
        }
    }

    private void driveRobot() {
        double forward = -gamepad1.left_stick_y;
        double strafe = gamepad1.left_stick_x;
        double rotate = gamepad1.right_stick_x;
        double fl = forward + strafe + rotate;
        double bl = forward - strafe + rotate;
        double fr = forward - strafe - rotate;
        double br = forward + strafe - rotate;
        double denominator = Math.max(1.0, Math.max(Math.max(Math.abs(fl), Math.abs(bl)), Math.max(Math.abs(fr), Math.abs(br))));
        double speed = gamepad1.left_bumper ? 0.28 : 0.7;
        frontLeft.setPower(fl / denominator * speed);
        backLeft.setPower(bl / denominator * speed);
        frontRight.setPower(fr / denominator * speed);
        backRight.setPower(br / denominator * speed);
    }
}