package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "DECODE Robot TeleOp", group = "Rangers Seasons")
public class DecodeTeleOp extends LinearOpMode {
    private DcMotor frontLeft;
    private DcMotor frontRight;
    private DcMotor backLeft;
    private DcMotor backRight;
    private DcMotor intake;
    private DcMotor lift;
    private Servo scorer;

    private boolean previousA;
    private boolean scorerOpen;

    @Override
    public void runOpMode() {
        frontLeft = hardwareMap.get(DcMotor.class, "frontLeft");
        frontRight = hardwareMap.get(DcMotor.class, "frontRight");
        backLeft = hardwareMap.get(DcMotor.class, "backLeft");
        backRight = hardwareMap.get(DcMotor.class, "backRight");
        intake = hardwareMap.get(DcMotor.class, "intake");
        lift = hardwareMap.get(DcMotor.class, "lift");
        scorer = hardwareMap.get(Servo.class, "scorer");

        frontLeft.setDirection(DcMotor.Direction.REVERSE);
        backLeft.setDirection(DcMotor.Direction.REVERSE);
        lift.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        frontLeft.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        frontRight.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        backLeft.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        backRight.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);

        scorer.setPosition(0.25);

        waitForStart();

        try {
            while (opModeIsActive()) {
                drive();
                controlIntake();
                controlLift();
                controlScorer();
                telemetry.addData("Scorer", scorerOpen ? "Open" : "Closed");
                telemetry.addData("Lift encoder", lift.getCurrentPosition());
                telemetry.addData("Intake power", intake.getPower());
                telemetry.update();
            }
        } finally {
            stopAll();
        }
    }

    private void drive() {
        double y = -gamepad1.left_stick_y;
        double x = gamepad1.left_stick_x;
        double rx = gamepad1.right_stick_x;
        double fl = y + x + rx;
        double bl = y - x + rx;
        double fr = y - x - rx;
        double br = y + x - rx;
        double max = Math.max(1.0, Math.max(Math.max(Math.abs(fl), Math.abs(bl)), Math.max(Math.abs(fr), Math.abs(br))));
        double scale = gamepad1.left_bumper ? 0.3 : 0.75;
        frontLeft.setPower((fl / max) * scale);
        backLeft.setPower((bl / max) * scale);
        frontRight.setPower((fr / max) * scale);
        backRight.setPower((br / max) * scale);
    }

    private void controlIntake() {
        double power = 0;
        if (gamepad2.right_trigger > 0.08) power = gamepad2.right_trigger;
        if (gamepad2.left_trigger > 0.08) power = -gamepad2.left_trigger;
        intake.setPower(power);
    }

    private void controlLift() {
        double power = -gamepad2.left_stick_y * 0.65;
        if (Math.abs(power) < 0.05) power = 0;
        lift.setPower(power);
    }

    private void controlScorer() {
        if (gamepad2.a && !previousA) {
            scorerOpen = !scorerOpen;
            scorer.setPosition(scorerOpen ? 0.75 : 0.25);
        }
        previousA = gamepad2.a;
    }

    private void stopAll() {
        frontLeft.setPower(0);
        frontRight.setPower(0);
        backLeft.setPower(0);
        backRight.setPower(0);
        intake.setPower(0);
        lift.setPower(0);
    }
}