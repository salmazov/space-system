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
	FVector2D MinCameraPosition = FVector2D(-2600.0f, -2300.0f);
	FVector2D MaxCameraPosition = FVector2D(8200.0f, 2200.0f);
};