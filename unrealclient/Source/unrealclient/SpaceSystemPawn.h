#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "SpaceSystemPawn.generated.h"

class UCameraComponent;
class USceneComponent;

UCLASS()
class UNREALCLIENT_API ASpaceSystemPawn : public APawn
{
	GENERATED_BODY()

public:
	ASpaceSystemPawn();

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	USceneComponent* SceneRoot;

	UPROPERTY()
	UCameraComponent* Camera;

	float MoveSpeed = 1800.0f;
	float EdgePanMargin = 42.0f;
	float MouseWheelZoomStep = 520.0f;
	float ZoomSpeed = 2200.0f;
	float MinCameraHeight = 1100.0f;
	float MaxCameraHeight = 6200.0f;
	FVector2D MinCameraPosition = FVector2D(-4200.0f, -4300.0f);
	FVector2D MaxCameraPosition = FVector2D(9600.0f, 3600.0f);
};