#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SpaceSystemLevelActor.generated.h"

class UMaterialInstanceDynamic;
class UMaterialInterface;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;

struct FSpaceSystemPlanetView
{
	FString Id;
	FString Name;
	FString Faction;
	FVector2D MapPosition = FVector2D::ZeroVector;
	FLinearColor Color = FLinearColor::White;
	float Scale = 1.0f;
};

UCLASS()
class UNREALCLIENT_API ASpaceSystemLevelActor : public AActor
{
	GENERATED_BODY()

public:
	ASpaceSystemLevelActor();

protected:
	virtual void BeginPlay() override;

private:
	UPROPERTY()
	USceneComponent* SceneRoot;

	UPROPERTY()
	UStaticMesh* SphereMesh;

	UPROPERTY()
	UStaticMesh* CubeMesh;

	UPROPERTY()
	UStaticMesh* CylinderMesh;

	UPROPERTY()
	UMaterialInterface* BaseMaterial;

	TArray<FSpaceSystemPlanetView> Planets;

	void BuildPlanetData();
	void BuildLighting();
	void BuildGrid();
	void BuildStars();
	void BuildPlanets();
	void BuildRoutes();
	void BuildPlayerShip();
	void BuildStatusBeacon();

	FVector ToWorldPosition(const FVector2D& MapPosition, float Height = 0.0f) const;
	UMaterialInstanceDynamic* CreateColorMaterial(const FLinearColor& Color, FName Name);
	UStaticMeshComponent* AddMesh(FName Name, UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color);
	UTextRenderComponent* AddLabel(FName Name, const FString& Text, const FVector& Location, float Size, const FColor& Color);
	void AddCylinderLine(FName Name, const FVector& Start, const FVector& End, float Radius, const FLinearColor& Color);
};