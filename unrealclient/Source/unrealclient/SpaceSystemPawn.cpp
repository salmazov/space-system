#include "SpaceSystemPawn.h"

#include "Camera/CameraComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "InputCoreTypes.h"

ASpaceSystemPawn::ASpaceSystemPawn()
{
	PrimaryActorTick.bCanEverTick = true;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	RootComponent = SceneRoot;

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("StrategyCamera"));
	Camera->SetupAttachment(SceneRoot);
	Camera->SetFieldOfView(46.0f);
	Camera->SetRelativeRotation(FRotator(-58.0f, 0.0f, 0.0f));
}

void ASpaceSystemPawn::BeginPlay()
{
	Super::BeginPlay();

	SetActorLocation(FVector(1500.0f, -2600.0f, 3100.0f));
	SetActorRotation(FRotator(0.0f, 32.0f, 0.0f));

	if (APlayerController* Controller = Cast<APlayerController>(GetController()))
	{
		Controller->bShowMouseCursor = true;
		Controller->bEnableClickEvents = true;
		Controller->bEnableMouseOverEvents = true;

		FInputModeGameAndUI InputMode;
		InputMode.SetHideCursorDuringCapture(false);
		InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		Controller->SetInputMode(InputMode);
	}
}

void ASpaceSystemPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	const APlayerController* Controller = Cast<APlayerController>(GetController());
	if (!Controller)
	{
		return;
	}

	FVector Direction = FVector::ZeroVector;
	Direction.X += Controller->IsInputKeyDown(EKeys::W) ? 1.0f : 0.0f;
	Direction.X -= Controller->IsInputKeyDown(EKeys::S) ? 1.0f : 0.0f;
	Direction.Y += Controller->IsInputKeyDown(EKeys::D) ? 1.0f : 0.0f;
	Direction.Y -= Controller->IsInputKeyDown(EKeys::A) ? 1.0f : 0.0f;

	int32 ViewportWidth = 0;
	int32 ViewportHeight = 0;
	Controller->GetViewportSize(ViewportWidth, ViewportHeight);

	float MouseX = 0.0f;
	float MouseY = 0.0f;
	if (ViewportWidth > 0 && ViewportHeight > 0 && Controller->GetMousePosition(MouseX, MouseY))
	{
		Direction.Y -= MouseX <= EdgePanMargin ? 1.0f : 0.0f;
		Direction.Y += MouseX >= static_cast<float>(ViewportWidth) - EdgePanMargin ? 1.0f : 0.0f;
		Direction.X += MouseY <= EdgePanMargin ? 1.0f : 0.0f;
		Direction.X -= MouseY >= static_cast<float>(ViewportHeight) - EdgePanMargin ? 1.0f : 0.0f;
	}

	FVector NewLocation = GetActorLocation();
	if (!Direction.IsNearlyZero())
	{
		const FRotator YawOnly(0.0f, GetActorRotation().Yaw, 0.0f);
		const FVector Forward = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::X);
		const FVector Right = FRotationMatrix(YawOnly).GetUnitAxis(EAxis::Y);
		NewLocation += (Forward * Direction.X + Right * Direction.Y).GetSafeNormal() * MoveSpeed * DeltaSeconds;
	}

	const float KeyboardZoomInput = (Controller->IsInputKeyDown(EKeys::E) ? 1.0f : 0.0f) - (Controller->IsInputKeyDown(EKeys::Q) ? 1.0f : 0.0f);
	const float MouseWheelInput = Controller->GetInputAnalogKeyState(EKeys::MouseWheelAxis);
	NewLocation.Z = FMath::Clamp(NewLocation.Z + KeyboardZoomInput * ZoomSpeed * DeltaSeconds - MouseWheelInput * MouseWheelZoomStep, MinCameraHeight, MaxCameraHeight);
	NewLocation.X = FMath::Clamp(NewLocation.X, MinCameraPosition.X, MaxCameraPosition.X);
	NewLocation.Y = FMath::Clamp(NewLocation.Y, MinCameraPosition.Y, MaxCameraPosition.Y);
	SetActorLocation(NewLocation);
}