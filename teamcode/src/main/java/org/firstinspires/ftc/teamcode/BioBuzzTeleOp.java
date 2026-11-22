package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.Servo;

@TeleOp(name = "BioBuzz Modular TeleOp", group = "Rangers Seasons")
public class BioBuzzTeleOp extends LinearOpMode {
    private DcMotor frontLeft;
    private DcMotor frontRight;
    private DcMotor backLeft;
    private DcMotor backRight;
    private DcMotor lift;
    private DcMotor intake;
    private Servo endEffector;
    private boolean endEffectorExtended;
    private boolean lastToggle;

    @Override
    public void runOpMode() {
        frontLeft = hardwareMap.get(DcMotor.class, "frontLeft");
        frontRight = hardwareMap.get(DcMotor.class, "frontRight");
        backLeft = hardwareMap.get(DcMotor.class, "backLeft");
        backRight = hardwareMap.get(DcMotor.class, "backRight");
        lift = hardwareMap.get(DcMotor.class, "lift");
        intake = hardwareMap.get(DcMotor.class, "intake");
        endEffector = hardwareMap.get(Servo.class, "endEffector");

        frontLeft.setDirection(DcMotor.Direction.REVERSE);
        backLeft.setDirection(DcMotor.Direction.REVERSE);
        lift.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        endEffector.setPosition(0.2);

        waitForStart();

        try {
            while (opModeIsActive()) {
                double y = -gamepad1.left_stick_y;
                double x = gamepad1.left_stick_x;
                double turn = gamepad1.right_stick_x;
                double fl = y + x + turn;
                double bl = y - x + turn;
                double fr = y - x - turn;
                double br = y + x - turn;
                double divisor = Math.max(1.0, Math.max(Math.max(Math.abs(fl), Math.abs(bl)), Math.max(Math.abs(fr), Math.abs(br))));
                double speed = gamepad1.left_bumper ? 0.25 : 0.65;

                frontLeft.setPower(fl / divisor * speed);
                backLeft.setPower(bl / divisor * speed);
                frontRight.setPower(fr / divisor * speed);
                backRight.setPower(br / divisor * speed);

                lift.setPower(-gamepad2.left_stick_y * 0.5);
                intake.setPower(gamepad2.right_trigger - gamepad2.left_trigger);

                if (gamepad2.a && !lastToggle) {
                    endEffectorExtended = !endEffectorExtended;
                    endEffector.setPosition(endEffectorExtended ? 0.8 : 0.2);
                }
                lastToggle = gamepad2.a;

                telemetry.addData("Drive speed", speed);
                telemetry.addData("Lift encoder", lift.getCurrentPosition());
                telemetry.addData("End effector", endEffectorExtended ? "Extended" : "Retracted");
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
}